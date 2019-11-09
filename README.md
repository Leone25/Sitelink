# Message to mysql database discord bot
The purpose of this bot is to dump the messages sent in a chat channel of discord to a mySQL database, with content, time, id, sender id, attachments links and image links all separated.

I made this realy quick for a friend, so don't expect much.

## Features
 - Dump messages to mySQL database
 - Scalable, this bot is able to work across multiple servers at the same time, with the same code running and can be configured all from the config file
 - Auto extraction of links and attachments that are passed as json elements to the database
 - Include time, id and id of the author of the message

 ## How to set up
  1. First make shure that you have the latest version of [node js](nodejs.org) installed.
  2. Run this command in a command prompt to install all the libraries required to run the code: ``` npm i mysql discord.js ``` .
  3. Copy the example and open the config file and add your bot key.
  4. Next put all the required setting about wich channel would you like to be checked (Put the ID that can be obtained by right clicking on the channel name on the channel list), and all the information reguarding the database you'd like the information to be sent. Note that you can put as much channels and server as you want as the 'servers' parameter is an array. 
  5. Save and with the help of the [developer portal on the discord website](discordapp.com/developers) make your bot join the server in wich the channel to check is present.
  6. Setup the database table with the following query, replacing "TABLE_NAME" as appropriate.
  ```
  CREATE TABLE `TABLE_NAME` (
  `message` longtext NOT NULL,
  `id` varchar(25) NOT NULL,
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
 - Have no idea

 ## If any problem comes up or something please open an issue on github

 Have a great life!
