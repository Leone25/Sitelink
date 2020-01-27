const Discord = require('discord.js');
const client = new Discord.Client();
const config = require('./config.json');
var mysql      = require('mysql');

var urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;

client.on('ready', () => {
	if (config.playing !== "") {
		client.user.setPresence({ status: 'online', game: { name: config.playing } });
	}
	console.log(`Logged in as ${client.user.tag}!`);
	console.log(`To send missing messages run ${config.prefix}dump [quantity(default and limited to 99)]`);	
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
		
		number = message.content.slice(6);
		
		if (number=='') number = 99;
		
		//console.log(number);
		
		message.delete(2);
		
		
		
		var channel = message.channel;
		
		async function run() {
			var fetched = await channel.fetchMessages({limit: number});
			//console.log(fetched);
			
			var connection = mysql.createConnection({
				host     : serverData.dbHost,
				user     : serverData.dbUser,
				password : serverData.dbPassword,
				database : serverData.db
			});
			
			var sql = 'SELECT * FROM `'+serverData.dbTable+'`';
			connection.connect();
			
			connection.query(sql, function (error, results, fields) {
				if (error) throw error;
				//console.log('Data recived from db. Result: ', results);
				var messages = [];
				fetched.forEach(messageNow => {
					
					var found = false;
					var edited = true;
					
					results.forEach(function (msg){
						if (messageNow.id == msg.id || messageNow.id == message.id ) {
							found = true;
						}
						
						//console.log('message:' + ((messageNow.editedTimestamp == null) ? "nope" : messageNow.editedTimestamp) + ' db: ' + msg.timeEdit);
						
						if (found == true && (messageNow.editedTimestamp || "") == msg.timeEdit) {
							edited = false;
						}
					});
					
					if (found==true && edited==true) {
						messages.push({"message":messageNow, "action":1});
					} else if (found==false) {
						messages.push({"message":messageNow, "action":0});
					}
					
				});
				//console.log(messages);
				sendLoop(messages, serverData, 1000);
			});

			connection.end();
		}
		
		run();
	} else {
		sendToDB(message, serverData);
	}

});

client.on('messageUpdate', (messageOld, messageNew) => {
	
	if (messageNew.author.bot==true) return;
	
	var serverData = undefined;

	config.servers.forEach(function(server) {
		if (messageNew.channel.id==server.channel) serverData = server;
	});

	if (serverData==undefined) return;
	
	var channel = messageNew.channel;
		
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});
	
	var sql = 'SELECT * FROM `'+serverData.dbTable+'`';
	
	connection.connect();

	connection.query(sql, function (error, results, fields) {
		if (error) throw error;
		//console.log('Data recived from db. Result: ', results);
		var messages = [];
		results.forEach(messageNow => {
			if (messageNow.id == messageNew.id) {
				messages.push({"message":messageNew, "action":1});
			}
		});
		sendLoop(messages, serverData, 1000);
	});

	connection.end();
	
});


client.on('messageDelete', message => {
	if (message.author.bot==true) return;
	
	var serverData = undefined;

	config.servers.forEach(function(server) {
		if (message.channel.id==server.channel) serverData = server;
	});

	if (serverData==undefined) return;
	
	deleteFromDB(message, serverData);
	
});

client.login(config.token);

function sendLoop(messages, serverData, delay) {
	
	if (messages.length == 0) {
		return;
	}
	if (messages[0].action == 0) {
		sendToDB(messages[0].message, serverData);
	} else if (messages[0].action == 1) {
		updateDB(messages[0].message, serverData);
	} else if (messages[0].maction == 2) {
		deleteFromDB(messages[0].message, serverData);
	}
	
	messages.shift();
	
	setTimeout(sendLoop, delay, messages, serverData, delay);
	
}

function updateDB(message, serverData) {
	
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

	var post = {message:messageContent, id:message.id, time:message.createdTimestamp, timeEdit:(message.editedTimestamp || ""), user:author, links:JSON.stringify(l), images:JSON.stringify(i)};
	var sql = 'UPDATE '+serverData.dbTable+' SET ? WHERE id='+message.id;
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log('Data updated in db. Result: ', results);
	});

	connection.end();
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

	var post = {message:messageContent, id:message.id, time:message.createdTimestamp, timeEdit:(message.editedTimestamp || ""), user:author, links:JSON.stringify(l), images:JSON.stringify(i)};
	var sql = 'INSERT INTO '+serverData.dbTable+' SET ?';
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log('Data sent to db. Result: ', results);
	});

	connection.end();
}

function deleteFromDB(message, serverData) {
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});
	
	var sql = 'DELETE FROM '+serverData.dbTable+' WHERE id='+message.id;
	connection.connect();

	connection.query(sql, function (error, results, fields) {
		if (error) throw error;
		console.log('Data deleted in db. Result: ', results);
	});

	connection.end();
}