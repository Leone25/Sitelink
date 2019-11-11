const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
var mysql      = require('mysql');

var urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', message => {

	if (message.author.bot==true) return;

	var serverData = undefined;

	config.servers.forEach(function(server) {
		if (message.channel.id==server.channel) serverData = server;
	});

	if (serverData==undefined) return;

	var l = [];

	var msgCopy = message.content;

	msgCopy.replace(urlRegex, function(url) {
        l.push(url);
    });

	var i = [];

	message.attachments.forEach(attachment => {
		i.push(attachment.url);
	});

	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});

	var mentions = [];
	message.mentions.users.forEach(user => {
		mentions.push({"userId": user.id, "username": user.username, "discriminator": user.discriminator});
	});
	var messageContent = message.content;
	for (mention of mentions) {
		if(messageContent.includes(mention.userId)) {
			if (serverData.mentionsMode == 0) {
				var author = message.author.id;
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.userId);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.userId);
			} else if (serverData.mentionsMode == 1) {
				var author = message.author.username;
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username);
			} else {
				var author = message.author.tag;
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
			}
			
		}
	}

	var post = {message:messageContent, id:message.id, time:message.createdTimestamp, user:author, links:JSON.stringify(l), images:JSON.stringify(i)};
	var sql = 'INSERT INTO '+serverData.dbTable+' SET ?';
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log('Data sent to db. Result: ', results);
	});

	connection.end();


});

client.login(config.token);
