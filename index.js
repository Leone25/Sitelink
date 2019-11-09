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
	
	var post = {Message:message.content, Id:message.id, Time:message.createdTimestamp, User:message.author.id, Links:JSON.stringify(l), Images:JSON.stringify(i)};
	var sql = 'INSERT INTO messages SET ?';
	connection.connect();
	
	connection.query(sql, post, function (error, results, fields) {
		if (error) throw error;
		console.log('Data sent to db. Result: ', results);
	});
	
	connection.end();
	
	
});

client.login(config.token);