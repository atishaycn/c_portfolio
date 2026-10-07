import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('drive_visual_review', Path(__file__).with_name('drive-visual-review.py'))
review = importlib.util.module_from_spec(spec)
spec.loader.exec_module(review)


class VisualReviewTests(unittest.TestCase):
    def test_identical_images_have_zero_distance(self):
        image = Image.new('RGB', (80, 60), '#cc3311')
        sig = review.signature(image)
        self.assertEqual(review.distance(sig, sig)['score'], 0)

    def test_hash_collision_does_not_hide_different_colors(self):
        a = review.signature(Image.new('RGB', (80, 60), 'black'))
        b = review.signature(Image.new('RGB', (80, 60), 'white'))
        result = review.distance(a, b)
        self.assertEqual(result['hashDistance'], 0)
        self.assertEqual(result['colorMse'], 1)
        self.assertGreater(result['score'], 8)

    def test_thumbnail_requests_do_not_carry_credentials(self):
        data = io.BytesIO()
        Image.new('RGB', (80, 60), 'red').save(data, 'JPEG')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'thumbs').mkdir()
            with patch.object(review, 'REVIEW', root), patch.object(review.urllib.request, 'urlopen') as request:
                request.return_value = io.BytesIO(data.getvalue())
                file_id, signature, error = review.fetch_thumbnail({'id': 'photo-id', 'thumbnailLink': 'https://lh3.googleusercontent.com/thumbnail'})
                self.assertEqual(file_id, 'photo-id')
                self.assertIsNone(error)
                self.assertIsNotNone(signature)
                headers = dict(request.call_args.args[0].header_items())
                self.assertNotIn('Authorization', headers)
                self.assertEqual((root / 'thumbs/drive-photo-id.jpg').stat().st_mode & 0o777, 0o600)

    def test_invalid_ids_and_untrusted_hosts_are_not_downloaded(self):
        with patch.object(review.urllib.request, 'urlopen') as request:
            self.assertIsNone(review.fetch_thumbnail({'id': '../token', 'thumbnailLink': 'https://lh3.googleusercontent.com/image'})[1])
            self.assertIsNone(review.fetch_thumbnail({'id': 'valid', 'thumbnailLink': 'https://example.com/image'})[1])
            request.assert_not_called()


if __name__ == '__main__':
    unittest.main()
