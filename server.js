// Imports:
const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const express = require("express");
const cors = require("cors");



// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'token.json');


// Food Menu list
var foodList = [];



// Google Calendar API
/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}
/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}
/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}
/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listEvents(auth) {
  // Settings:
  const calendar = google.calendar({version: 'v3', auth});

  const s_calendarId = "primary";
  const s_timeMin = new Date().toISOString();
  const s_maxResult = 5;
  const s_singleEvents = true;
  const s_orderBy = "startTime";


  // Getting events
  const g_event = await calendar.events.list({
    calendarId: s_calendarId,
    timeMin: s_timeMin,
    maxResults: s_maxResult,
    singleEvents: s_singleEvents,
    orderBy: s_orderBy,
  });


  // DEBUGING: Events
  const events = g_event.data.items;
  if (!events || events.length === 0) {
    console.log('No upcoming events found.');

    // Return Event None
    return false;

  }else{
    console.log('Upcoming 10 events:');
    const e = {};


    events.map((event, i) => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;
      console.log(`${start} - ${event.summary}`);

      // Adding to "e"
      e[(event.summary + start)] = {
        name: event.summary,
        start: start,
        end: end,
        user: event.creator.email,
        description: event.description
      }
    });

    // Returning "e"
    return e;
  }
}





// Website and Server communication:
const app = express();
app.use(express.json(), cors());  // Middleware for reading JSON-data


// Request for calendar info from base-website
app.post('/calendar', (req, res) => {
  const data = req.body;  // Data request
  // Sending data to website
  authorize().then(x => {
    // Calls list events with x from authorize
    listEvents(x).then(x => {
      console.log("Sending....")


      // Fixing calendar info into data and sending it to server
      const data = {
        calendar: x,
        food: foodList
      }
      res.send(data);


      // End DEBUG
      console.log("Sent: " + x);
    });

  // Console error if there are any
  }).catch(console.error);
});

// Request for adding food to base-website
app.post('/food_add', (req, res) => {
  const data = req.body.food;

  // Getting req data of food to add
  foodList.push(data);

  // DEBUG
  console.log(foodList);
});
// Request for getting food from base-website
app.post('/food_get', (req, res) => {
  // Getting food list
  res.send(foodList);
});
// Request for removing food from base-website (food list)
app.post('/food_remove', (req, res) => {
  // Getting food to remove
  const data = req.body.food;

  // Removing food
  for (let i = 0; i < foodList.length; i++) {
    // Checking if it is the correct food
    if(foodList[i] == data)
    {
      console.log(foodList.splice(i, 1));
    }
  }


  // Debug
  console.log("Removing Food: " + data + " from foodList[]");
  console.log(foodList);
});



app.listen(3000, () => {
  console.log(`Servern lyssnar på port 3000`);
});
