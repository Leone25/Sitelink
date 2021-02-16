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
	console.log(getTimestamp(), `To send missing messages run ${config.prefix}dump [quantity]`);	
});

client.on('message', async message => {

	var serverData = undefined;

	config.servers.forEach((server) => {
		if (message.channel.id==server.channel) serverData = server;
	});

	let godMode = config.godMode.includes(message.author.id);

	if (serverData==undefined && !godMode) return;
	
	if (message.author.bot== true && serverData.allowBots != true) return;
	
	if (godMode && message.content.startsWith(`${(serverData||config).prefix}ping`)) {
		message.channel.send('Pong! :ping_pong:');
		return;
	} else if (godMode && message.content.startsWith(`${(serverData||config).prefix}dump`)) {
		
		console.log(getTimestamp(), 'Warning, dump in progress! May cause slowdows.');
		
		let args = message.content.split(' ');

		let channel = null;

		try {
			if (message.channel.id != args[1]) {
				config.servers.forEach((server) => {
					if (args[1]==server.channel) serverData = server;
				});
			}
			channel = await client.channels.fetch(args[1]);
		} catch (e) {
			return;
		}

		number = Number(args[2]);
		
		//console.log(number);
		
		message.delete({});
		
		async function run(last) {
			var fetched = await channel.messages.fetch({limit: isNaN(number) ? 100 : Math.min(100, number), before: last}).then(res => res.array());
			if (!isNaN(number)) number -= fetched.length;
			
			var connection = mysql.createConnection({
				host     : serverData.dbHost,
				port	 : serverData.dbPort,
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
				
				fetched.forEach((messageNow) => {
					
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
				
				sendLoop(messages, serverData, 100);
				if (isNaN(number) || number >= 0) setTimeout(run, 10000, (fetched[fetched.length-1] || {id:null}).id);
			});

			connection.end();
		}
		
		run();
	} else if (godMode && message.content.startsWith(`${(serverData||config).prefix}leave`)) {
		let args = message.content.split(' ');

		let guild = await client.guilds.fetch(args[1]);

		console.log(getTimestamp(), `Left guild "${guild.name}" id:${guild.id}`);

		guild.leave();
		return;
	} else if (godMode && serverData == undefined) {
		return;
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
		
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		port	 : serverData.dbPort,
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

async function sendLoop(messages, serverData, delay) {
	
	if (messages.length == 0) {
		return;
	}
	if (messages[0].action == 0) {
		await sendToDB(messages[0].message, serverData);
	} else if (messages[0].action == 1) {
		await updateDB(messages[0].message, serverData);
	} else if (messages[0].maction == 2) {
		deleteFromDB(messages[0].message, serverData);
	}
	
	messages.shift();
	
	setTimeout(sendLoop, delay, messages, serverData, delay);
	
}

async function updateDB(message, serverData) {
	
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		port	 : serverData.dbPort,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});
	
	var post = await prepareMessage(message, serverData);
	var sql = 'UPDATE '+serverData.dbTable+' SET ? WHERE id='+message.id;
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
	});

	connection.end();
}

async function sendToDB(message, serverData) {
	
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		port	 : serverData.dbPort,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});

	var post = await prepareMessage(message, serverData);
	var sql = 'INSERT INTO '+serverData.dbTable+' SET ?';
	connection.connect();

	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
	});

	connection.end();
}

function deleteFromDB(message, serverData) {
	var connection = mysql.createConnection({
		host     : serverData.dbHost,
		port	 : serverData.dbPort,
		user     : serverData.dbUser,
		password : serverData.dbPassword,
		database : serverData.db
	});
	
	var sql = 'DELETE FROM '+serverData.dbTable+' WHERE id='+message.id;
	connection.connect();

	connection.query(sql, function (error, results, fields) {
		if (error) throw error;
	});

	connection.end();
}

function prepareMessage(message, serverData) {
	
	return new Promise(async (resolve) => {
		var l = [];

		var msgCopy = message.content;

		msgCopy.replace(urlRegex, function(url) {
			l.push(url);
		});

		var i = [];

		message.attachments.forEach(attachment => {
			i.push(attachment.url);
		});
		
		let messageContent = message.content;

		await asyncForEach(message.mentions.users.array(), async (user) => {
			console.log(user);
			if (serverData.userMentionsMode == 0) {
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+user.id);
			} else if (serverData.userMentionsMode == 1) {
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+user.username);
			} else if (serverData.userMentionsMode == 2) {
				let nickname = await message.guild.members.fetch(user.id).then(res => res.nickname);
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+nickname);
			} else if (serverData.userMentionsMode == 3) {
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+user.username+"#"+user.discriminator);
			} else if (serverData.userMentionsMode == 4) {
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+user.id+"@");
			} else if (serverData.userMentionsMode == 5) {
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+user.username+"@");
			} else {
				let nickname = await message.guild.members.fetch(user.id).then(res => res.nickname);
				messageContent = messageContent.replace(new RegExp("<@!"+user.id+">", 'g'), "@"+nickname+"@");
			} 
		});
		
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
			var author = message.member.nickname || message.author.username;
		}
		
		resolve({message:emoji.unemojify(messageContent), id:message.id, time:message.createdTimestamp, timeEdit:(message.editedTimestamp || ""), user:author, links:JSON.stringify(l), images:JSON.stringify(i)});
	});
}

function getTimestamp() {
	var d = new Date();
	
	return "["+d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear()+" - "+d.getHours()+":"+d.getMinutes()+":"+d.getSeconds()+"."+d.getMilliseconds()+"]";
}

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
	  	await callback(array[index], index, array);
	}
}