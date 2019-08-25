#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const tar = require('tar');
const moment = require('moment');
const { argv } = require('yargs')
  .option('world', {
    alias: 'w',
    default: 'world'
  })
  .option('nether', {
    alias: 'n',
    default: 'world_nether'
  })
  .boolean('upload');

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_SECRET_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY_ID
});

const date = moment();

AWS.config.logger = console;

const zipBackup = (worlds, backupName) => new Promise((resolve, reject) => {
  console.log(`Zipping ${worlds.length} world(s) ->`, backupName);

  fs.writeFileSync('./server-backups/backup-info.txt', JSON.stringify({
    backup_date: date.format('D-M-YYYY'),
    backup_time: date.format('H:m:s'),
  }, null, 4));

  tar.c({
    gzip: true,
    file: `./server-backups/${backupName}`,
  }, [...worlds, "./server-backups/backup-info.txt"])
    .then(() => {
      fs.unlinkSync('./server-backups/backup-info.txt');
      resolve();
    })
    .catch(reject)
});

const uploadToS3 = (backupName) => new Promise((resolve, reject) => {
  console.log('Uploading to s3...');
  const params = {
    Bucket: process.env.BACKUP_TOOL_S3_BUCKET,
    Key: backupName,
    Body: fs.createReadStream(`./server-backups/${backupName}`)
  };

  s3.upload(params, (error, data) => {
    if (error) {
      return reject(error);
    }
    console.log('Uploaded, download from:', data.Location);
    return resolve(data);
  });
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

  if (!fs.existsSync('./server-backups')) {
    fs.mkdirSync('server-backups');
  }

  const todaysDate = date.format('D-M-YYYY');
  const currentTime = !argv.u ? date.format('-H:mm:ss') : '';

  const backupName = `server-backup-${todaysDate}${currentTime}.tgz`;

  await zipBackup(worldsToBackup, backupName);

  if (argv.u)
    await uploadToS3(backupName)

  console.log('Backup completed');

  const oldBuildDate = date.subtract('7', 'days').format('D-M-YYYY');
  const backupDirectory = fs.readdirSync('./server-backups');
  console.log('Searching for old backups from', oldBuildDate);

  backupDirectory.forEach(backup => {
    if (backup.includes(oldBuildDate)) {
      console.log('Removed', backup);
      fs.unlinkSync(`./server-backups/${backup}`);
    }
  });

})();