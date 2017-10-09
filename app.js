const config = require('./settings.js');
const fs = require('fs') ;

const TelegramBot = require('node-telegram-bot-api'); 
const bot = new TelegramBot(config.token, {polling: true});

var botChatId = 0 ;    
var inlineKeyboard = false;
 

function isAdmin(id) {
	return (id == config.botOwnerChatId) ;
}

function isAuthorized(id) {
	return true ;
};

function keyboardMarkUp(btn, type) {  //type : inline_keyboard | keyboard ;  btn = Array of button attributes
	
	var keyboard ;	
	var markup;	
	markup = '{"reply_markup" :{ "' + type  + '": [' + btn +  ']}, "one_time_keyboard":true}';
	keyboard = JSON.parse(markup) ;
	return keyboard ;
	
}

function keyGen() {
	
	var num = Math.round(10000 + 99999 * Math.random()) ;
	return num ;
}

const sqlite3 = require('sqlite3').verbose();
var file = "./newslinks.db"; 
var dbExist = false; 
if (fs.existsSync(file)) {
	dbExist = true ;
} ;

var db = new sqlite3.Database(file); 

if (! dbExist) {
	db.serialize(function() {	
      db.run("CREATE TABLE news (id INTEGER PRIMARY KEY, create_dttm NOT NULL DEFAULT CURRENT_TIMESTAMP)");	 
	  db.run("CREATE VIRTUAL TABLE fts_news USING FTS4 (id, abstract)");
	});
};

/*
db.each("SELECT id, create_dttm FROM news", function(err, row) {
		  console.log(row.id, ":", row.create_dttm);
	  });
	  
db.each("SELECT  id, abstract FROM fts_news WHERE fts_news MATCH 'An'", function(err, row) {
		  console.log(row.id, ":", row.abstract);
	  });
*/

bot.onText(/\/start/, (msg) => {
    if (! isAuthorized) return ;
	retMsg = "Availble commands:" + "\r\n" ;
	retMsg = retMsg + "/start : initiates session. \r\n"   ;
	retMsg = retMsg + "/q to search. \r\n"  ;
	retMsg = retMsg + "Others message containing news link will be captured." ;
	// retMsg = retMsg + "/inlinekeyboard on|off: turn on|off inline keyboard"  ;
	bot.sendMessage(msg.chat.id, retMsg) ;
	botChatId = msg.chat.id ;
});

bot.onText(/\/inlinekeyboard/, (msg) => {
	if (! isAdmin(msg.chat.id)) 
		return ;
		
	if (msg.text.indexOf(" on") > 0) {
			inlineKeyboard = true ;			
	} else 
		{
			if (msg.text.indexOf(" off") > 0){
				inlineKeyboard = false ;								
			} else {
				bot.sendMessage(msg.chat.id, "Please use valid settings : on | off") ;			
				return ;
			} ;
		};
		
	bot.sendMessage(msg.chat.id, "Configuration done.");	
	 
	
}) ;

bot.onText(/\/l/, (msg) => {

	if (! isAdmin(msg.chat.id)) {
	    bot.sendMessage(msg.chat.id, "Only Administrator is authorized.");
		return ;
	} 

	var num = msg.text.substr(3, msg.text.length-2) ;
	var numericEx = /^\d{1,2}$/ ;
	if (! numericEx.test(num)) {
		bot.sendMessage(msg.chat.id, "Please provided a positive numeric value less than 100.") ;
		return ;
	};
	var limit = parseInt(num) ;
	if (limit > 0) {
		config.recordLimit = limit;
		bot.sendMessage(msg.chat.id, "Search result limit increased to " + limit.toString() + " records.") ;
	}
	//console.log(limit);
});

bot.on("message", (msg) => {
		
	var retMsg ;
		
	if (msg.text.substr(0,6) == "/start")  
		return  ;
		
	if (msg.text.substr(0,15) == "/inlinekeyboard") 
		return  ;
		
	if (msg.text.substr(0,2) == "/l") 
		return  ;
	
	if (msg.text.substr(0,2) != "/q") {
		
		if (msg.text.indexOf("http://") <= 0 && msg.text.indexOf("https://") <= 0 ) {
				retMsg = "Sorry, this is not a valid news link and will not be captured in the db."  + "\r\n\r\n" ;
				retMsg = retMsg + "To search for links, please enter /q <search criteria> instead." ;
				retMsg = retMsg + "At most 15 records is returned.  To increase, request administrator to enter /l <no of records>";
				bot.sendMessage(msg.chat.id, retMsg) ;				
		} else {;		
			db.serialize(function() {
				var info = msg.text ;
				var id = keyGen() ;
				var stmt = db.prepare("INSERT INTO news(id) VALUES (?)");
				var fts_stmt = db.prepare("INSERT INTO fts_news(id, abstract) VALUES (?,?)");
				stmt.run(id);
				fts_stmt.run(id, info) ;				   
				stmt.finalize(); 
				fts_stmt.finalize() ;
				retMsg = "Added news links to db." ;
				bot.sendMessage(msg.chat.id, retMsg) ;
			}) ;
		};
	} else {
		var search = msg.text.substr(3,msg.text.length) ;
		//var cnt = 0 ;
		//console.log(search) ;	
		var cnt = 0 ;
		db.serialize(function() {		    
			var query = "SELECT id, abstract FROM fts_news WHERE fts_news MATCH '" + search + "' LIMIT " + config.recordLimit ;  //NOTE : 15 records at most
			
			db.each(query, function(err, row) {		  
				if (! err) {
					console.log(row.id, row.abstract);
					retMsg = row.abstract ;
					bot.sendMessage(msg.chat.id,  retMsg) ;
					cnt++ ;
					if (cnt > 1) 
						return ;
				}  else {
					retMsg = "Encountered search error." ;
					bot.sendMessage(msg.chat.id, retMsg) ;
					
				}	
			}, function(err, rowCount) {   
				if (rowCount == 0) {
					retMsg = "No search result." ;
					bot.sendMessage(msg.chat.id, retMsg) ;
				} else {
					//retMsg = rowCount.toString() + " records." ;
					//console.log (retMsg) ;
					//bot.sendMessage(msg.chat.id, retMsg) ; 
				}	
			});			
			
			if (cnt > 0) {
				
			};
			
		}) ;  //db.serialize
		
		
	};
	
});	  
	  
	  
	  
//db.close() ;


