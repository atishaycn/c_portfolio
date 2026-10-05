/** The email Claire gets when a client submits (or resubmits) their intake. */
const buildSubmitEmail = (submitted, resultsUrl) => {
	const verb = submitted.resubmitted ? "updated" : "finished";
	const lines = [
		`${submitted.clientName} ${verb} their intake for the ${submitted.eventTypeName.toLowerCase()} on ${submitted.shootDate}.`,
		"",
		`Must-have poses: ${submitted.mustHaves}`,
		"",
		`See their answers and shot list: ${resultsUrl}`,
	];
	return {
		subject: `Intake ${verb}: ${submitted.clientName} (${submitted.eventTypeName})`,
		text: lines.join("\n"),
	};
};

module.exports = { buildSubmitEmail };
