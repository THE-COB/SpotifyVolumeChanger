'use strict';

const open = require('open');
const request = require('request');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
let parser = bodyParser.urlencoded({extended: false});

const port = 3000;

const hotkeys = require('node-hotkeys')

let client_id = '8bcb18f826f0438cabccb8538a12bfaa'; // Definitely not a client_id 
let client_secret = 'suck my dick lmao'; // Definitely a client_secret
let redirect_uri = 'http:%2F%2Flocalhost:3000%2Fcallback'

let auth = `https://accounts.spotify.com/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&scope=user-read-playback-state%20user-modify-playback-state&response_type=token`;

let token = "";

function getDeviceStatus(){
    let options = {
    url: 'https://api.spotify.com/v1/me/player/devices',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    json: true
  };
  
  return new Promise((resolve, reject) => {
    request.get(options, function(error, response, body) {
      let allDevices = body["devices"];
      allDevices.forEach((el) => {
        if(el["is_active"]){
          let devId = el["id"];
          let currVol = el["volume_percent"];
          resolve({"devId": devId, "currVol": currVol});
        }
      });
      reject("No playing device");
    });  
  })
}

function setVolume(newVol, changeVol){
  var headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer '+token
  };

  getDeviceStatus().then((devStatus) => {
    let device = devStatus["devId"];
    if(changeVol) {
      newVol = devStatus["currVol"] + changeVol;
    }
    var options = {
        url: `https://api.spotify.com/v1/me/player/volume?volume_percent=${newVol}&device_id=${device}`,
        method: 'PUT',
        headers: headers
    };

    function callback(error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body);
        }
    }

    request(options, callback);
  }).catch((err) => {
    console.log(err);
  });
}

function setHotkey(conf){
  hotkeys.on({
    hotkeys: conf["key"],
    callback: function(hotkey) {
      if(conf["volumeSet"]) {
        console.log(`${conf["key"]} sets volume to ${conf["volumeSet"]}`);
        setVolume(conf["volumeSet"], null);
      }
      if(conf["volumeChange"]) {
        console.log(`${conf["key"]} changes volume by ${conf["volumeChange"]}`);
        setVolume(null, conf["volumeChange"]);
      }
    }
  })
}

function configureDevice(){
  let rawConfig = fs.readFileSync('config.json');
  let parsedConfig = JSON.parse(rawConfig);
  parsedConfig["keybinds"].forEach((el) => {
    setHotkey(el);
  });
  (async () => {
    while (parsedConfig["showKeyDetections"]) {
      let hotkeyStr = await hotkeys.getNextHotkey(false);
      console.log("Detected:", hotkeyStr);
    }
  })();
}

let frontendTokenScript = 
`
<script>
var token = window.location.hash.match(/.+\=(.+)&t/)[1]
var xhr = new XMLHttpRequest();
xhr.open('POST', 'http://localhost:3000/set-token', true);
xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
xhr.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
        window.close();
    }
}
xhr.send("token="+token);
</script>
`;

app.get('/callback', (req, res) => {
  res.send(frontendTokenScript);
});

app.post('/set-token', parser, (req,res) => {
  res.send(req.body.token);
  token = req.body.token;
  configureDevice();
})

app.listen(port, () => {
  open(auth);
});