const twilio = require('twilio')

const client = twilio(process.env.TWILIO_API_KEY_SID, process.env.TWILIO_API_KEY_SECRET, {
	accountSid: process.env.TWILIO_ACCOUNT_SID
});

const conferenceHelper = require('./helpers/conference-helper.js')

module.exports.getConference = function (req, res) {
	const payload = {}

	conferenceHelper
		.getConferenceByName('conf_' + req.params.sid)
		.then(conference => {
			payload.conferenceSid = conference.sid

			return conferenceHelper.getConferenceParticipants(conference.sid)
		})
		.then(participants => {
			const list = participants.filter(function (callSid) {
				if (callSid !== req.body.callSid) {
					return callSid
				}
			})

			if (list.length !== 0) {
				payload.callSid = list[0]
			}

			res.json(payload)
		})
		.catch(error => {
			res.status(500).end()
		})
}


module.exports.call = async function (req, res) {
  let name = 'conf_' + req.body.CallSid;

  const twiml = new twilio.twiml.VoiceResponse();
  const start = twiml.start();
  start.stream({ url: 'wss://voicenology.increzon.com/transcribe/', track: 'both_tracks'});

  // const dial = twiml.dial({ callerId: req.configuration.twilio.callerId });
  const dial = twiml.dial({ callerId: await getCallerId(req.body.phone) });
	console.log(callerId);
  dial.conference(
    {
      endConferenceOnExit: true,
      statusCallbackEvent: 'join',
      statusCallback: `/api/phone/call/${req.body.CallSid}/add-participant/${encodeURIComponent(req.body.phone)}`
    },
    name
  );

  res.set({
    'Content-Type': 'application/xml',
    'Cache-Control': 'public, max-age=0',
  });
  // console.log(twiml.toString());
  res.send(twiml.toString());
}


module.exports.addParticipant = function (req, res) {

	if (req.body.CallSid === req.params.sid) {
		/* the agent joined, we now call the phone number and add it to the conference */
		client
			.conferences('conf_' + req.params.sid)
			.participants.create({
				to: req.params.phone,
				from: req.configuration.twilio.callerId,
				earlyMedia: true,
				endConferenceOnExit: true
			}).then(participant => {
				res.status(200).end()
			})
			.catch(error => {
				console.error(error)
				res.status(500).end()
			})

	} else {
		res.status(200).end()
	}

}

module.exports.hold = function (req, res) {

	client
		.conferences(req.body.conferenceSid)
		.participants(req.body.callSid)
		.update({ hold: req.body.hold })
		.then(participant => {
			res.status(200).end()
		})
		.catch(error => {
			res.status(500).end()
		})

}

async function getCallerId(targetNumber) {
    try {
        const availableNumbers = await client.incomingPhoneNumbers.list();
        return selectTwilioNumber(availableNumbers, targetNumber);
    } catch (error) {
        console.error('Error fetching available Twilio numbers:', error);
        throw error;
    }
}

// Function to select a Twilio number based on geo-location of the target number
function selectTwilioNumber(numbers, targetNumber) {
    // Implement your logic to select the best number based on geo-location of the targetNumber
    // For simplicity, let's assume we select the first number
    return numbers[1].phoneNumber;
}
