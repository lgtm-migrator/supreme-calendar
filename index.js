const fs = require("fs")
const readline = require("readline")
const { google } = require("googleapis")
const { request } = require("http")
let lowestPriority = -1
let totalCalendars = 0
let calendarsId = []
let wasLastEventOutside
let headingHome

function futureDay(days = 14) {
	const today = new Date()
	const futureDay = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate() + days
	)
	return futureDay
}

// If modifying these scopes, delete token.json.
const SCOPES = [
	"https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
]
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json"

// Load client secrets from a local file.
fs.readFile("credentials.json", (err, content) => {
	if (err) return console.log("Error loading client secret file:", err)
	// Authorize a client with credentials, then call the Google Calendar API.
	authorize(JSON.parse(content), copyExternalCalendars)
	// authorize(JSON.parse(content), listCalendars)
	// authorize(JSON.parse(content), listEvents)
})
/**
 * given callback function
 *               function(err) { console.error("Execute error", err); )
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	const { client_secret, client_id, redirect_uris } = credentials.installed
	const oAuth2Client = new google.auth.OAuth2(
		client_id,
		client_secret,
		redirect_uris[0]
	)

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, (err, token) => {
		if (err) return getAccessToken(oAuth2Client, callback)
		oAuth2Client.setCredentials(JSON.parse(token))
		callback(oAuth2Client)
	})
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES,
	})
	console.log("Authorize this app by visiting this url:", authUrl)
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	rl.question("Enter the code from that page here: ", (code) => {
		rl.close()
		oAuth2Client.getToken(code, (err, token) => {
			if (err) return console.error("Error retrieving access token", err)
			oAuth2Client.setCredentials(token)
			// Store the token to disk for later program executions
			fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
				if (err) return console.error(err)
				console.log("Token stored to", TOKEN_PATH)
			})
			callback(oAuth2Client)
		})
	})
}
/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */

let externalCalendarsId = []
let externalCalendarsSummary = []
let externalCalendarsCounter = 0
let externalCalendarEventsId = []
let externalCalendarEventsSummary = []
let externalCalendarEventsStart = []
let externalCalendarEventsEnd = []
let importedEventsId = []
let copyCalendarsId = []
let copyCalendarsSummary = []

const doCopyCalendarEvents = async (auth) => {
	try {
		const calendar = google.calendar({ version: "v3", auth })
		/*********************************************
		 * Import the events of the external calendars
		 *********************************************/
		console.log(`\tSearching External Calendars...`)
		const calendarListResponse = await calendar.calendarList.list({})
		for (let i = 0; i < calendarListResponse.data.items.length; i++) {
			const calendarItem = calendarListResponse.data.items[i]
			const endLetter = calendarItem.summary.slice(-1)
			console.log(`\t\tendLetter : ${endLetter}`)
			if (+endLetter === 9) {
				const summaryLength = calendarItem.summary.length
				console.log(`\t\t#9 calendar found`)
				externalCalendarsId[externalCalendarsCounter] = calendarItem.id
				externalCalendarsSummary.push(
					calendarItem.summary.slice(0, +summaryLength - 2)
				)
				externalCalendarsCounter++
			} else {
				const isTheCopy = calendarItem.summary.includes("copy")
				if (isTheCopy) {
					const summaryLength = calendarItem.summary.length
					copyCalendarsId.push(calendarItem.id)
					copyCalendarsSummary.push(
						calendarItem.summary.slice(0, +summaryLength - 2)
					)
				}
			}
		}
		console.log(
			`\t\texternalCalendarsCounter : ${externalCalendarsCounter}`
		)
		for (let i = 0; i < externalCalendarsCounter; i++) {
			console.log(
				`\t\texternalCalendarsId[${i}] : ${externalCalendarsId[i]}`
			)
			externalCalendarEventsId[i] = []
			externalCalendarEventsSummary[i] = []
			externalCalendarEventsStart[i] = []
			externalCalendarEventsEnd[i] = []
			importedEventsId[i] = []
		}
		console.log(`\tListing external calendar events...`)
		console.log(
			`\t\texternalCalendarsCounter : ${externalCalendarsCounter}`
		)
		for (let i = 0; i < externalCalendarsCounter; i++) {
			const externalCalendarId = externalCalendarsId[i]

			const externalCalendarEventsResponse = await calendar.events.list({
				calendarId: externalCalendarId,
				timeMin: new Date().toISOString(),
				timeMax: futureDay(),
				maxResults: 2,
				singleEvents: true,
				orderBy: "startTime",
			})
			/*********************************************
			 * Import the events of the external calendars
			 *********************************************/
			if (externalCalendarEventsResponse) {
				const events = externalCalendarEventsResponse.data.items
				if (events.length) {
					console.log("\t\tUpcoming 6 events:")
					events.map((event, j) => {
						const start = event.start.dateTime || event.start.date
						const end = event.end.dateTime || event.end.date
						const id = event.id
						const summary = event.summary
						console.log(`\t\t${start} - ${end} | ${event.summary}`)
						if (start.length != 10) {
							/**	//TODO:
							 * Filter the events that long more than a day and start or ends in a specific hour
							 */
							externalCalendarEventsId[i].push(id)
							console.log(
								`\t\t\texternalCalendarEventsId[${i}][${j}] : ${externalCalendarEventsId[i][j]}`
							)
							externalCalendarEventsSummary[i].push(summary)
							console.log(
								`\t\t\texternalCalendarEventsSummary[${i}][${j}] : ${externalCalendarEventsSummary[i]}`
							)
							externalCalendarEventsStart[i].push(start)
							console.log(
								`\t\t\texternalCalendarEventsSummary[${i}][${j}] : ${externalCalendarEventsSummary[i]}`
							)
							externalCalendarEventsEnd[i].push(end)
							console.log(
								`\t\t\texternalCalendarEventsSummary[${i}][${j}] : ${externalCalendarEventsSummary[i]}`
							)
						} else {
							console.log(
								`This event longs more the whole day or more`
							)
						}
					})
					console.log(`\tChecking the arrays`)
					for (
						let j = 0;
						j < externalCalendarEventsId[i].length;
						j++
					) {
						console.log(
							`\t\texternalCalendarEventsId[${i}][${j}] : ${externalCalendarEventsId[i][j]}\n\t\texternalCalendarEventsSummary[${i}][${j}] : ${externalCalendarEventsSummary[i][j]}\n\t\texternalCalendarEventsStart[${i}][${j}] : ${externalCalendarEventsStart[i][j]}\n\t\texternalCalendarEventsEnd[${i}][${j}] : ${externalCalendarEventsEnd[i][j]}\n`
						)
					}
				} else {
					console.log(`No events Found`)
				}
			} else {
				console.log(
					`There was an error while listing that calendar events`
				)
			}
		}
		console.log(
			`\t\texternalCalendarEventsId[0].length : ${externalCalendarEventsId[0].length}`
		)
		console.log(`\tImporting events`)
		/*********************************************
		 * Import the events of the external calendars
		 *********************************************/
		for (let i = 0; i < externalCalendarsCounter; i++) {
			console.log(
				`\t\texternalCalendarsId[${i}] : ${externalCalendarsId[i]}`
			)
			console.log(
				`\t\texternalCalendarEventsId[${i}].length : ${externalCalendarEventsId[i].length}\n`
			)
			for (let j = 0; j < externalCalendarEventsId[i].length; j++) {
				console.log(
					`\t\texternalCalendarEventsSummary[${i}][${j}] : ${externalCalendarEventsSummary[i][j]}\n\t\texternalCalendarEventsStart[${i}][${j}] : ${externalCalendarEventsStart[i][j]}\n\t\texternalCalendarEventsEnd[${i}][${j}] : ${externalCalendarEventsEnd[i][j]}\n\t\texternalCalendarEventsId[${i}][${j}] : ${externalCalendarEventsId[i][j]}`
				)
				console.log(
					`\n{\n\tcalendarId: ${externalCalendarsId[i]},\n\tconferenceDataVersion: 1,\n\tsupportsAttachments: true,\n\tresource: {\n\t\tend: {\n\t\t\tdateTime: ${externalCalendarEventsEnd[i][j]},\n\t\t},\n\t\tiCalUID: ${externalCalendarEventsId[i][j]},\n\t\tstart: {\n\t\t\tdateTime: ${externalCalendarEventsStart[i][j]},\n\t\t},\n\t\tsummary: ${externalCalendarEventsSummary[i][j]},\n}\n,`
				)
				const calendarEventImportResponse = await calendar.events.import(
					{
						calendarId: `${externalCalendarsId[i]}`,
						conferenceDataVersion: 1,
						supportsAttachments: true,
						resource: {
							end: {
								dateTime: `${externalCalendarEventsEnd[i][j]}`,
							},
							iCalUID: `${externalCalendarEventsId[i][j]}`,
							start: {
								dateTime: `${externalCalendarEventsStart[i][j]}`,
							},
							summary: `${externalCalendarEventsSummary[i][j]}`,
						},
					}
				)
				importedEventsId[i].push(calendarEventImportResponse.data.id)
			}
		}
		/*********************************************
		 * Move the new events to the copy calendar
		 *********************************************/
		let copyCalendarId
		for (let i = 0; i < externalCalendarsCounter; i++) {
			for (let k = 0; k < copyCalendarsId.length; k++) {
				const isTheCopy = copyCalendarsSummary[k].includes(
					externalCalendarsSummary[i]
				)
				if (isTheCopy) {
					copyCalendarId = copyCalendarsId[k]
					console.log(
						`${copyCalendarsSummary[k]} includes ${externalCalendarsSummary[i]}\ncopyCalendarId:${copyCalendarId}`
					)
					break
				}
			}
			for (let j = 0; j < importedEventsId[i].length; j++) {
				const moveExternalCalendarToCopy = await calendar.events.move({
					calendarId: `${externalCalendarsId[i]}`,
					eventId: `${importedEventsId[i][j]}`,
					destination: `${copyCalendarId}`,
				})
				if (moveExternalCalendarToCopy) {
					console.log("Response", moveExternalCalendarToCopy)
				} else {
					console.error("Move error")
				}
			}
		}
	} catch (error) {
		console.error(error)
	}
}

const standardizeAndFirstCheck = async (auth) => {
	try {
		const calendar = google.calendar({ version: "v3", auth })
		/*********************************************
		 * Get Calendar Id's
		 *********************************************/
		console.log(`Getting Calendar Id's`)
		const calendarListResponse = await calendar.calendarList.list({})
		let itemIndexHolder = []

		console.log(`Data length : ${calendarListResponse.data.items.length}`)

		for (let i = 0; i < calendarListResponse.data.items.length; i++) {
			const element = calendarListResponse.data.items[i].summary.slice(-1)
			if (element > -1 && element < 9) {
				itemIndexHolder[totalCalendars] = i
				totalCalendars++
				if (element > lowestPriority) {
					lowestPriority = element
				}
			}
		}
		for (let i = 0; i < lowestPriority + 1; i++) {
			calendarsId[i] = []
		}
		console.log(`\ttotalCalendars : ${totalCalendars}`)
		console.log(`\tlowestPriority : ${lowestPriority}`)
		for (let i = 0; i < totalCalendars; i++) {
			const indexHolder = itemIndexHolder[i]
			for (let j = 0; j < +lowestPriority + 1; j++) {
				if (
					+calendarListResponse.data.items[indexHolder].summary.slice(
						-1
					) === j
				) {
					calendarsId[j].push(
						calendarListResponse.data.items[indexHolder].id
					)
				}
			}
		}
	} catch (error) {
		console.error(error)
	}
}

const listCalendars = async (auth) => {
	try {
		const calendar = google.calendar({ version: "v3", auth })

		console.log(`\n\tcalendarsId :\n`)

		for (let i = 0; i < +lowestPriority + 1; i++) {
			console.log(`[${i}]:`)
			for (let j = 0; j < calendarsId[i].length; j++) {
				console.log(`calendarsId[${i}][${j}] : ${calendarsId[i][j]}`)
			}
		}

		console.log(`Checking all events in all calendars`)
		for (let i = 0; i < +lowestPriority + 1; i++) {
			for (let j = 0; j < calendarsId[i].length; j++) {
				console.log(`calendarsId[${i}][${j}] : ${calendarsId[i][j]}`)
				calendar.events.list(
					{
						calendarId: calendarsId[i][j],
						timeMin: new Date().toISOString(),
						timeMax: futureDay(),
						maxResults: 10,
						singleEvents: true,
						orderBy: "startTime",
					},
					(err, res) => {
						if (err)
							return console.log(
								"The API returned an error: " + err
							)
						const events = res.data.items
						if (events.length) {
							console.log(
								`\n\tUpcoming 10 events in [${i}][${j}] calendar:\n`
							)
							events.map((event, i) => {
								const start =
									event.start.dateTime || event.start.date
								const end = event.end.dateTime || event.end.date
								console.log(
									`${start} - ${end} | ${event.summary}\n${event.id}`
								)
							})
						} else {
							console.log("No upcoming events found.")
						}
					}
				)
			}
			console.log(`\t\t<--  No more events in ${i} priority  -->`)
		}
	} catch (error) {
		console.error(error)
	}
}

async function copyExternalCalendars(auth) {
	try {
		// console.log(`Copying external calendars...`)
		// await doCopyCalendarEvents(auth)
		console.log(`standardizing the descriptions and first check...`)
		await standardizeAndFirstCheck(auth)
		console.log(`descriptions...`)
		await listCalendars(auth)
	} catch (error) {
		console.error(error)
	}
}
