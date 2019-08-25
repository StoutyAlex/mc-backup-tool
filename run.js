#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const tar = require('tar');
const path = require('path');
const moment = require('moment');
const { argv } = require('yargs')
  .option('world', {
    alias: 'w',
    default: 'world'
  })
  .option('nether', {
    alias: 'n',
    default: 'world_nether'
  });

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_SECRET_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY_ID
});

AWS.config.logger = console;

const zipBackup = (worlds, backupName) => new Promise((resolve, reject) => {
  console.log(`Zipping ${worlds.length} world(s) -> `, backupName);

  const currentTime = moment();

  fs.writeFileSync('backup-info.txt', JSON.stringify({
    backup_date: currentTime.format('D-M-YYYY'),
    backup_time: currentTime.format('H:m:s'),
  }, null, 4));

  tar.c({
    gzip: true,
    file: backupName
  }, [...worlds, "backup-info.txt"])
    .then(() => {
      fs.unlinkSync('backup-info.txt');
      resolve();
    })
    .catch(reject)
});

module.exports = (async () => {
  const worldsToBackup = [];

  if (fs.existsSync(argv.world)) {
    console.log(`Found world: "${argv.world}"`);
    worldsToBackup.push(argv.world);
  }

  if (fs.existsSync(argv.nether)){
    console.log(`Found nether world: "${argv.nether}"`);
    worldsToBackup.push(argv.nether);
  }

  const backupName = `server-backup-${moment().format('D-M-YYYY')}.tgz`;
  await zipBackup(worldsToBackup, backupName);

  console.log(process.env);

  const params = {
    Bucket: process.env.BACKUP_TOOL_S3_BUCKET,
    Key: backupName,
    Body: fs.createReadStream(backupName)
  };

  s3.upload(params, (res) => console.log(res));
})();