const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
var mysql      = require('mysql');

var urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	console.log(`To send missing messages run ${config.prefix}dump`);	
});

client.on('message', message => {

	if (message.author.bot==true) return;
	
	var serverData = undefined;

	config.servers.forEach(function(server) {
		if (message.channel.id==server.channel) serverData = server;
	});

	if (serverData==undefined) return;
	
	if (message.content.startsWith(`${config.prefix}dump`)) {
		console.log('Warning, dump in progress! May cause slowdows.');
		
		message.delete(2);
		
		var channel = message.channel;
		
		async function run() {
			var fetched = await channel.fetchMessages({limit: 99});
			//console.log(fetched);
			
			var connection = mysql.createConnection({
				host     : serverData.dbHost,
				user     : serverData.dbUser,
				password : serverData.dbPassword,
				database : serverData.db
			});
			
			var sql = 'SELECT * FROM `messages`';
			connection.connect();

			connection.query(sql, function (error, results, fields) {
				if (error) throw error;
				console.log('Data recived from db. Result: ', results);
				var messages = [];
				fetched.forEach(messageNow => {
					
					var found = null;
					
					results.forEach(function (msg){
						if (messageNow.id == msg.Id || messageNow.id == message.id) {
							found = 'yep';
						}
					});
					
					if (found==null) {
						messages.push(messageNow);
					}
				});
				sendLoop(messages, serverData, 1000);
			});

			connection.end();
		}
		
		run();
	} else {
		sendToDB(message, serverData);
	}

});

client.login(config.token);

function sendLoop(messages, serverData, delay) {
	
	if (messages.length == 0) {
		return;
	}
	
	sendToDB(messages[0], serverData);
	
	messages.shift();
	
	setTimeout(sendLoop, delay, messages, serverData, delay);
	
}

function sendToDB(message, serverData) {
	
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});
	
	var l = [];

	var msgCopy = message.content;

	msgCopy.replace(urlRegex, function(url) {
        l.push(url);
    });

	var i = [];

	message.attachments.forEach(attachment => {
		i.push(attachment.url);
	});

	

	var mentions = [];
	message.mentions.users.forEach(user => {
		mentions.push({"userId": user.id, "username": user.username, "discriminator": user.discriminator});
	});
	var messageContent = message.content;
	for (mention of mentions) {
		if(messageContent.includes(mention.userId)) {
			if (serverData.mentionsMode == 0) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.userId);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.userId);
			} else if (serverData.mentionsMode == 1) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username);
			} else {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
			}
			
		}
	}

	if (serverData.authorMode == 0) {
		var author = message.author.id;
	} else if (serverData.authorMode == 1) {
		var author = message.author.username;
	} else {
		var author = message.author.tag;
	}

	var post = {message:messageContent, id:message.id, time:message.createdTimestamp, user:author, links:JSON.stringify(l), images:JSON.stringify(i)};
	var sql = 'INSERT INTO '+serverData.dbTable+' SET ?';
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log('Data sent to db. Result: ', results);
	});

	connection.end();
}
