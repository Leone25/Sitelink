# SiteLink
## Message to mysql database discord bot
The purpose of this bot is to dump the messages sent in a chat channel of discord to a MySQL database, with content, time, id, sender id, attachments links and image links all separated.

## Features
 - Dump messages to mySQL database
 - Scalable, this bot is able to work across multiple servers at the same time, with the same code running and can be configured all from the config file
 - Auto extraction of links and attachments that are passed as json elements to the database
 - Include time stamp and id of the message
 - Able to choose if to send the id, username or tag of the author of the message according to what's needed

 ## How to set up
  1. First make shure that you have the latest version of [NodeJS](https://nodejs.org/en/) and [MySQL](https://www.mysql.com/) installed.
  2. Run this command in a command prompt to install all the libraries required to run the code: `npm install` .
  3. Copy the example config to `config.json` and configure as detailed below.

  |Setting|Description|
  |--|--|
  |`token`|Discord API bot token|
  |`servers`|Arrays of configured servers|
  |`servers.channel`|ID of Discord channel to listen to|
  |`servers.mentionsMode`| Conversion settings for user mentions in Discord messages. 0 will set as the user ID, e.g. `@182925154211332097`. 1 will set as just the username, e.g. `@Owen`. Anything else will set as the username + discriminator, e.g. `@Owen#1111`|
  |`servers.authorMode`|Same settings as `mentionsMode` but for message authors|
  |`servers.dbHost`|MySQL database host|
  |`servers.dbUser`|MySQL database username|
  |`servers.dbPassword`|MySQL database password|
  |`servers.db`|MySQL database to store data in|
  |`servers.dbTable`|MySQL database table to store data in|

 
  4. Connect your bot to your guild, guidance on [developer portal on the discord website](https://discordapp.com/developers).
  5. Setup the MySQL database table with the following query, replacing "TABLE_NAME" as appropriate.
  ```
  CREATE TABLE `TABLE_NAME` (
  `message` longtext NOT NULL,
  `id` text NOT NULL,
  `time` varchar(25) NOT NULL,
  `user` text NOT NULL,
  `links` text NOT NULL,
  `images` text NOT NULL
) COLLATE 'utf8mb4_unicode_ci';
```
  7. Start the bot by running ` node index.js ` or ` nodemon ` (`start.bat` on Windows)
  8. Congratulation, your bot is up and running!

## To do stuff
 - Make the bot automaticly send message that hasn't been send to the db on boot
 - Make the bot update data in the database if someone edits a message( and probably add a parameter on the db for the edited timestamp)
 - Automatically delete from database if message is removed on Discord

 ## If any problem comes up or something please open an issue on github

 Have a great life!
