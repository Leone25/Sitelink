const Discord = require('discord.js');
const client = new Discord.Client({ partials: ['MESSAGE', 'CHANNEL', 'REACTION'] });
const config = require('./config.json');
var mysql      = require('mysql');
var emoji = require('node-emoji');

var urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;

client.on('ready', () => {
	if (config.playing !== "") {
		client.user.setPresence({ status: 'online', game: { name: config.playing } });
	}
	console.log(getTimestamp(), `Logged in as ${client.user.tag}!`);
	console.log(getTimestamp(), `To send missing messages run ${config.prefix}dump [quantity(default and limited to 99)]`);	
});

client.on('message', message => {

	
	
	var serverData = undefined;

	config.servers.forEach(function(server) {
		if (message.channel.id==server.channel) serverData = server;
	});

	if (serverData==undefined) return;
	
	if (message.author.bot== true && serverData.allowBots != true) return;
	
	if (message.content.startsWith(`${serverData.prefix||config.prefix}ping`)) {
		message.channel.send('Pong! :ping_pong:');
		return;
	} else if (message.content.startsWith(`${serverData.prefix||config.prefix}dump`) && serverData.allowDump == true) {
		
		console.log(getTimestamp(), 'Warning, dump in progress! May cause slowdows.');
		
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
			
			var sql = 'SELECT * FROM `'+serverData.dbTable+'` ORDER BY `time` DESC';
			connection.connect();
			
			connection.query(sql, function (error, results, fields) {
				if (error) throw error;
				//console.log('Data recived from db. Result: ', results);
				var messages = [];
				var controlled = [];
				
				for (i = 0; i < number; i++) {
					controlled[i] = false;
				}
				
				fetched.forEach(messageNow => {
					
					var found = false;
					var edited = true;
					
					for (j = 0; j < results.length; j++) {
						var msg = results[j];
						if (messageNow.id == msg.id || messageNow.id == message.id ) {
							found = true;
							controlled[j] = true;
						}
						
						//console.log('message:' + ((messageNow.editedTimestamp == null) ? "nope" : messageNow.editedTimestamp) + ' db: ' + msg.timeEdit);
						
						if (found == true && (messageNow.editedTimestamp || "") == msg.timeEdit) {
							edited = false;
						}
					}
					
					if (found==true && edited==true) {
						messages.push({"message":messageNow, "action":1});
					} else if (found==false) {
						messages.push({"message":messageNow, "action":0});
					}
					
				});
				//console.log(messages);
				
				while(true) {
					break;
				}
				
				sendLoop(messages, serverData, 1000);
			});

			connection.end();
		}
		
		run();
	} else {
		sendToDB(message, serverData);
	}

});

client.on('messageUpdate', async (messageOld, messageNew) => {
	
	if (messageOld.partial) {
		// If the message was removed the fetching might result in an API error, which we need to handle
		try {
			await messageOld.fetch();
		} catch (error) {
			console.log(getTimestamp(), 'Something went wrong when fetching the message: ', error);
		}
	}
	
	if (messageNew.partial) {
		// If the message was removed the fetching might result in an API error, which we need to handle
		try {
			await messageNew.fetch();
		} catch (error) {
			console.log(getTimestamp(), 'Something went wrong when fetching the message: ', error);
		}
	}
	
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
	
	var post = prepareMessage(message, serverData);
	var sql = 'UPDATE '+serverData.dbTable+' SET ? WHERE id='+message.id;
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log(getTimestamp(), 'Data updated in db. Result: ', results);
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

	var post = prepareMessage(message, serverData);
	var sql = 'INSERT INTO '+serverData.dbTable+' SET ?';
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log(getTimestamp(), 'Data sent to db. Result: ', results);
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
		console.log(getTimestamp(), 'Data deleted in db. Result: ', results);
	});

	connection.end();
}

function prepareMessage(message, serverData) {
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
	message.mentions.members.forEach((member) => {
		mentions.push({"userId": member.user.id, "username": member.user.username, "discriminator": member.user.discriminator, "nickname": member.nickname || member.user.username});
	});
	
	var messageContent = message.content;
	for (mention of mentions) {
		if(messageContent.includes(mention.userId)) {
			if (serverData.userMentionsMode == 0) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.userId);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.userId);
			} else if (serverData.userMentionsMode == 1) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username);
			} else if (serverData.userMentionsMode == 2) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.nickname);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.nickname);
			} else if (serverData.userMentionsMode == 3) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username+"#"+mention.discriminator);
			} else if (serverData.userMentionsMode == 4) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.userId+"@");
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.userId+"@");
			} else if (serverData.userMentionsMode == 5) {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.username+"@");
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.username+"@");
			} else {
				messageContent = messageContent.replace(new RegExp("<@"+mention.userId+">", 'g'), "@"+mention.nickname+"@");
				messageContent = messageContent.replace(new RegExp("<@!"+mention.userId+">", 'g'), "@"+mention.nickname+"@");
			} 
			
		}
	}
	
	var mentions = [];
	message.mentions.channels.forEach(channel => {
		mentions.push({"channelId": channel.id, "name": channel.name});
	});
	for (mention of mentions) {
		if(messageContent.includes(mention.channelId)) {
			if (serverData.channelMentionsMode == 0) {
				messageContent = messageContent.replace(new RegExp("<#"+mention.channelId+">", 'g'), "#"+mention.channelId);
				messageContent = messageContent.replace(new RegExp("<#!"+mention.channelId+">", 'g'), "#"+mention.channelId);
			} else if (serverData.channelMentionsMode == 1) {
				messageContent = messageContent.replace(new RegExp("<#"+mention.channelId+">", 'g'), "#"+mention.name);
				messageContent = messageContent.replace(new RegExp("<#!"+mention.channelId+">", 'g'), "#"+mention.name);
			} else if (serverData.channelMentionsMode == 2) {
				messageContent = messageContent.replace(new RegExp("<#"+mention.channelId+">", 'g'), "#"+mention.channelId+"#");
				messageContent = messageContent.replace(new RegExp("<#!"+mention.channelId+">", 'g'), "#"+mention.channelId+"#");
			} else {
				messageContent = messageContent.replace(new RegExp("<#"+mention.channelId+">", 'g'), "#"+mention.name+"#");
				messageContent = messageContent.replace(new RegExp("<#!"+mention.channelId+">", 'g'), "#"+mention.name+"#");
			}
		}
	}
	
	var mentions = [];
	message.mentions.roles.forEach(role => {
		mentions.push({"roleId": role.id, "name": role.name, "color": role.color.toString(16)});
	});
	for (mention of mentions) {
		if(messageContent.includes(mention.roleId)) {
			if (serverData.roleMentionsMode == 0) {
				messageContent = messageContent.replace(new RegExp("<@&"+mention.roleId+">", 'g'), "&"+mention.roleId);
				messageContent = messageContent.replace(new RegExp("<@&!"+mention.roleId+">", 'g'), "&"+mention.roleId);
			} else if (serverData.roleMentionsMode == 1) {
				messageContent = messageContent.replace(new RegExp("<@&"+mention.roleId+">", 'g'), "&"+mention.name);
				messageContent = messageContent.replace(new RegExp("<@&!"+mention.roleId+">", 'g'), "&"+mention.name);
			} else {
				messageContent = messageContent.replace(new RegExp("<@&"+mention.roleId+">", 'g'), "&"+mention.name+"#"+mention.color);
				messageContent = messageContent.replace(new RegExp("<@&!"+mention.roleId+">", 'g'), "&"+mention.name+"#"+mention.color);
			}
		}
	}

	if (serverData.authorMode == 0) {
		var author = message.author.id;
	} else if (serverData.authorMode == 1) {
		var author = message.author.username;
	} else if (serverData.authorMode == 2) {
		var author = message.author.tag;
	} else {
		var author = message.member.nickname;
	}
	
	return {message:emoji.unemojify(messageContent), id:message.id, time:message.createdTimestamp, timeEdit:(message.editedTimestamp || ""), user:author, links:JSON.stringify(l), images:JSON.stringify(i)};
}

function getTimestamp() {
	var d = new Date();
	
	return "["+d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear()+" - "+d.getHours()+":"+d.getMinutes()+":"+d.getSeconds()+"."+d.getMilliseconds()+"]";
}
