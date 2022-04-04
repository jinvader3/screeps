// ######################################################################################################################################
// Documentation :
// ######################################################################################################################################
/*

    Goals :
    - This module defines the global variable 'ALLIANCE' which corresponding to the list of users in your alliance.
    - This module creates an 'InterPlayer' object available thanks to the global variable 'MESSENGER'.
      This object contain some method to communicate with other player in the game.

    Installation :
    To run this module, you have to :
        - Import the 'communication.player' module in the main function.
        - Write the following command in 'module.exports.loop' of the main module : MESSENGER.run(myUserName, audience);
            + myUserName : a string corresponding to your user name in the game.
            + audience : list of names of players you want to communicate with on a regular basis (default value is alliance users).
    
    The methods :
    Here are the useful methods of the object 'InterPlayer' :
        - send : this method allows you to 'send' a message to an other player (they have 50 ticks to reply). It needs the following arguments :
            + recipients : a string or a list of strings containing names of the player who you want to send a message.
            + subject : a string used as a keyword to translate the message.
            + body : string/object/list/... it's your message, it can be what you want.
            + id   : an optional string. If it's defined, the program will consider that the message is waiting for a response.
                    Once received, it will be stored in 'MESSENGER.message[id]'.
        - listen : this method allows to read the segment of a player. Usable even if he does't share the same communication protocol.
            + username  : the name of the player who you want to read the segment.
            + segment   : the id of the segment.
            + id        : an optional string. If it's set, the content of the scanned segment will be stored in 'MESSENGER.message[id]'.
                          Otherwise it will be displayed in the console.
        - notify : this method transmits information to all players whose validity is durable over time (such as for example prevent that one is at war)
            + tag     : a string to access players' reactions in the variable MESSENGER.notification[tag] and
                        to be able to redefine the notification using the 'notify' method again.
            + subject : a string uses to link the notification to a function to translate it
                        (delete the notification corresponding to the 'tag' if subject is undefined).
            + body    : string/object/... it's a data about what you want to notify, it can be what you want.
        - getAlliance : this method enable to get the name and users in a specific alliance.
                        Please enter the following command in the console to learn more : MESSENGER.getAlliance();
    
    Notes :
        - Segment 0 is, by default, the default segment.
        - Segment 51 is still active and public (this is the segment that allows us to communicate with our alliance members).

*/
// ######################################################################################################################################
// Functions to be modified according to the user's code :
// ######################################################################################################################################


// Function that translates a message or a notification according to the keyword 'subject' :
function reply(mySegment, sender, message) {

    let data = message.body;

    // TODO : Add subjects (with 'case') to process other types of requests. Do not forget that returning a value allows you to reply to the received message.
    switch(message.subject) {

        // Request to use a command line :
        case 'eval': return Eval(mySegment, sender, message, ['Harlem', 'Balthael', 'Aethercyn']); // TODO: complete the last argument, it is the list of userName allow to use command lines

        // Print the message in the console :
        case 'print': return console.log("[communication.player] " + sender + " : " + data);
    }

    // If the subject is unknown, an error is returned :
    return error(mySegment, sender, message, 'The subject of the message is unknown');

}


// ######################################################################################################################################
// Creating the 'InterPlayer' object :
// ######################################################################################################################################


// The object is accessible using a global variable :
global.MESSENGER = new InterPlayer();

// The constructor :
function InterPlayer() {
    this.message = {};
    this.notification = {};
    RawMemory.setActiveSegments([0,51]);
    RawMemory.setPublicSegments([0,51]);
    RawMemory.setDefaultPublicSegment(0);
    RawMemory.setActiveForeignSegment(null);
    if(!RawMemory.segments[51]) RawMemory.segments[51] = '{ "__notification__": {} }';
    else for(let notification in JSON.parse(RawMemory.segments[51] || '{}')['__notification__'] || {}) this.notification[notification] = {};
}

// To listen to a player :
let speaker, listen = [];


// ######################################################################################################################################
// Main methods and functions :
// ######################################################################################################################################


// The main method :
InterPlayer.prototype.run = function(myUserName, audience = (ALLIANCE || [])) {

    // Get my segment :
    let mySegment = JSON.parse(RawMemory.segments[51] || '{}');

    // Get the foreign segment :
    let foreignSegment = getForeignSegment(mySegment, audience);
    if(!foreignSegment) return nextSpeaker(myUserName, audience);

    // Read the messages addressed to us :
    readMessage(myUserName, mySegment, audience, foreignSegment);

    // Deleting messages sent to our interlocutor that have been read or are too old :
    deleteMessage(myUserName, mySegment, foreignSegment);

    // Read general informations about the player :
    readNotification(myUserName, mySegment, audience, foreignSegment);
    
    // We save the changes we made to our segment 51 :
    RawMemory.segments[51] = JSON.stringify(mySegment);

    // Update the list of users belonging to our alliance :
    updateAlliance(myUserName);

    // Set the player and the segment number that will be played at the next tick :
    nextSpeaker(myUserName, audience);

}


// Deleting messages sent to our interlocutor that have been read or are too old :
function deleteMessage(myUserName, mySegment, foreignSegment) {

    if(mySegment[foreignSegment.username]) {
        let read = (foreignSegment.data[myUserName] || {}).read || 0;
        _.remove(mySegment[foreignSegment.username].messages,
            function(message) {
                if(message.date < read) return true;
                if(Game.time - message.date >= 50) {
                    if(message.id && message.subject != '__reply__' && MESSENGER.message[message.id]) {
                        delete MESSENGER.message[message.id][foreignSegment.username];
                    }
                    return true;
                }
            }
        );
        if(!mySegment[foreignSegment.username].messages[0]
            && (!foreignSegment.data[myUserName] || !foreignSegment.data[myUserName].messages[0])) delete mySegment[foreignSegment.username];
    }

}


// Function to get the foreign segment as an object :
function getForeignSegment(mySegment, audience) {

    // Retrieval of the contact segment :
    let foreignSegment = RawMemory.foreignSegment;
    if(!foreignSegment) {
        if(!speaker) {
            let foreigner = audience[(Game.time + audience.length)%(audience.length + 1)];
            if(mySegment[foreigner]) {
                for(let message of mySegment[foreigner].messages) {
                    if(message.id) delete MESSENGER.message[message.id][foreigner];
                }
                delete mySegment[foreigner];
            }
        }
        else if(_.includes(audience, speaker.username)) {
            if(mySegment[speaker.username]) {
                for(let message of mySegment[speaker.username].messages) {
                    if(message.id) delete MESSENGER.message[message.id][speaker.username];
                }
                delete mySegment[speaker.username];
            }
        }
        else {
            if(speaker.id) delete MESSENGER.message[speaker.id][speaker.username];
            else console.log("[communication.player] Error: The segment N°" + speaker.segment + " of the player " + speaker.username + " is not public.");
        }
        RawMemory.segments[51] = JSON.stringify(mySegment);
        return;
    }

    // Retrieval of foreign segment data :
    let data;
    try {
        data = JSON.parse(foreignSegment.data || '{}');
    } catch(e) {
        if(speaker && speaker.id) MESSENGER.message[speaker.id] = foreignSegment.data;
        else console.log("[communication.player] Error: The following message from the segment N°" + foreignSegment.id + " of the player " + foreignSegment.username + " couldn't be parsered :\n" + foreignSegment.data);
        return;
    }

    // Return the foreign segment as an object :
    foreignSegment.data = data;
    return foreignSegment;

}


// Read general informations about the foreign player :
function readNotification(myUserName, mySegment, audience, foreignSegment) {

    // If the foreign player doesn't use the same communication protocol :
    if(speaker && !_.includes(audience, foreignSegment.username) || foreignSegment.username == myUserName) return;

    // Read general informations about the foreign player :
    let reply;
    for(let notification of Object.values(foreignSegment.data['__notification__'] || {})) {
        reply = getReply(mySegment, foreignSegment.username, notification);
        if(reply) {
            mySegment[foreignSegment.username].messages.push({
                subject: '__notify__',
                body: reply,
                tag: notification.tag,
                date: Game.time,
            });
        }
    }

}


// Function to read a segment :
function readMessage(myUserName, mySegment, audience, foreignSegment) {

    // Check if the foreign player uses the same communication protocol :
    if(!speaker || _.includes(audience, foreignSegment.username)) {

        // Check if messages that are explicitly addressed to us :
        if(foreignSegment.data[myUserName]) {

            let reply;
            if(!mySegment[foreignSegment.username]) mySegment[foreignSegment.username] = {messages : [], read : 0};

            // Read messages :
            for(let message of foreignSegment.data[myUserName].messages) {

                // We ignore messages already read :
                if(message.date < mySegment[foreignSegment.username].read || message.date >= Game.time) continue;
                
                // If a delayed answer is sent :
                if(message.subject == '__processing__') {
                    reply = getReply(mySegment, message.body.sender, message.body);
                    if(!_.isNull(reply)) {
                        mySegment[message.body.sender].messages.push({
                            subject: '__reply__',
                            body: reply,
                            id: message.body.id,
                            date: Game.time,
                        });
                    }
                    else if(Game.time - message.body.date < 50) {
                        mySegment[myUserName].messages.push({
                            subject: '__processing__',
                            body: message.body,
                            date: Game.time,
                        });
                    }
                    else {
                        console.log("[communication.player] Error: The response time to the following message sent by " + message.body.sender + " is over :\n" + JSON.stringify(message.body, null, 4));
                        mySegment[message.body.sender].messages.push({
                            subject: '__reply__',
                            body: undefined,
                            id: message.body.id,
                            date: Game.time,
                        });
                    }
                }
    
                // If we receive a response :
                else if(message.subject == '__reply__') {
                    if(!MESSENGER.message[message.id]) continue;
                    else MESSENGER.message[message.id][foreignSegment.username] = message.body;
                }
                
                // If a player reacts to one of our notifications :
                else if(message.subject == '__notify__') {
                    if(!MESSENGER.notification[message.tag]) continue;
                    else MESSENGER.notification[message.tag][foreignSegment.username] = message.body;
                }
    
                // If we send a reply :
                else {
                    reply = getReply(mySegment, foreignSegment.username, message);
                    if(message.id) {
                        if(_.isNull(reply)) {
                            message.sender = foreignSegment.username;
                            mySegment[myUserName].messages.push({
                                subject: '__processing__',
                                body: message,
                                date: Game.time,
                            });
                        }
                        else {
                            mySegment[foreignSegment.username].messages.push({
                                subject: '__reply__',
                                body: reply,
                                id: message.id,
                                date: Game.time,
                            });
                        }
                    }
                }
    
            }

            // Update the last time you read the segment of this foreign player :
            mySegment[foreignSegment.username].read = Game.time;

        }
        
    }

    // Read the segment of a player who does not share the same communication protocol :
    else {
        if(speaker.id) MESSENGER.message[speaker.id][foreignSegment.username] = foreignSegment.data;
        else console.log("[communication.player] Here is the content of the segment N°" + foreignSegment.id + " of the player '" + foreignSegment.username + "' :\n" + JSON.stringify(foreignSegment.data, null, 4));
    }
    
}


// Function that defines the player and the segment number that will be listened to at the next tick :
function nextSpeaker(myUserName, audience) {
    speaker = listen.shift();
    let index = Game.time%(audience.length + 1);
    if(speaker) RawMemory.setActiveForeignSegment(speaker.username, speaker.segment);
    else if(index == audience.length) RawMemory.setActiveForeignSegment(myUserName, 51);
    else RawMemory.setActiveForeignSegment(audience[index], 51);
}


// Function to get the reply to a message :
function getReply(mySegment, sender, message) {
    try {
        return reply(mySegment, sender, message);
    } catch(e) {
        error(mySegment, sender, message, '\n\n' + e.stack);
    }
}


// Action to do if there is an error :
function error(mySegment, sender, message, eStack) {

    // You receive an error message :
    console.log("[communication.player] Error: The following message sent by '" + sender + "' coudn't be translate :\n" + JSON.stringify(message, null, 4) + ((eStack)? '\n\nHere is the reason : ' + eStack : ''));
                
    // The sending player will receive an error message :
    mySegment[sender].messages.push({
        subject: 'print',
        body: "Error, the following message you sent me coudn't be translate :\n" + JSON.stringify(message, null, 4) + ((eStack)? '\n\nHere is the reason : ' + eStack : ''),
        date: Game.time,
    });

    // The sender's program doesn't need to wait for a reply :
    if(message.id) {
        mySegment[sender].messages.push({
            subject: '__reply__',
            body: undefined,
            id: message.id,
            date: Game.time,
        });
    }

}


// ######################################################################################################################################
// Utility methods :
// ######################################################################################################################################


// Method to read a player’s segment :
InterPlayer.prototype.listen = function(username, segment, id) {
    if(id) {
        if(this.message[id]) return this.message[id][username];
        this.message[id] = {};
        this.message[id][username] = null;
    }
    listen.push({
        username: username,
        segment: segment,
        id: id,
    });
    return null;
}


// Method to 'send' a personal message to a player.
InterPlayer.prototype.send = function(recipients, subject, body, id) {

    // Can not wait a reply if 'id' is already used :
    if(id) {
        if(this.message[id]) return this.message[id];
        this.message[id] = {};
    }
    
    // Recovery of data :
    let mySegment = JSON.parse(RawMemory.segments[51] || '{}');

    // Sends message to recipients :
    if(!_.isArray(recipients)) recipients = [recipients];
    for(let recipient of recipients) {
        if(!mySegment[recipient]) mySegment[recipient] = {messages : [], read : 0};
        if(id) this.message[id][recipient] = null;
        mySegment[recipient].messages.push({
            subject: subject,
            body: body,
            id: id,
            date: Game.time,
        });
    }

    // Update segment data :
    RawMemory.segments[51] = JSON.stringify(mySegment);
    if(id) return this.message[id];
    
}


// Method to notify our information data :
InterPlayer.prototype.notify = function(tag, subject, body) {

    // To delete a notification :
    if(!subject && !this.notification[tag]) return;

    // Get notification data :
    let mySegment = JSON.parse(RawMemory.segments[51] || '{}');
    let notification = mySegment['__notification__'] || {};
    
    // Write data in our notification data :
    if(!subject) {
        delete notification[tag];
        delete this.notification[tag];
    }
    else {
        notification[tag] = {
            subject: subject,
            body: body,
            tag: tag,
        };
        this.notification[tag] = {};
    }

    // Update segment data :
    mySegment['__notification__'] = notification;
    RawMemory.segments[51] = JSON.stringify(mySegment);
    
}


// ######################################################################################################################################
// Alliance management :
// ######################################################################################################################################


// The list of users belonging to our alliance :
global.ALLIANCE = null;


// To get some alliance data :
InterPlayer.prototype.getAlliance = function(type, name, id) {

    // Get alliance data :
    id = id || 'getAlliance_' + type + '_' + name;
    let alliances = this.listen('LeagueOfAutomatedNations', 99, id);
    if(!alliances) return;
    delete this.message[id];

    switch(type) {

        case 'user':
            for(let allianceName in alliances) {
                if(_.includes(alliances[allianceName], name)) return {
                    name: allianceName,
                    users: alliances[allianceName]
                }
            }
        break;

        case 'alliance': return {name: name, users: alliances[name] || []};

        default: return console.log("[communication.player] Error, the 'getAlliance' method received unknown 'type' argument.");

    }

    return {name: null, users: []};
    
}


// Update the list of users belonging to our alliance :
function updateAlliance(myUserName) {

    if(Game.time%5000 < 2 || !_.has(Memory, 'alliance') || !ALLIANCE) {
        let data = (Memory.alliance)? MESSENGER.getAlliance('alliance', Memory.alliance, 'ALLIANCE') : MESSENGER.getAlliance('user', myUserName, 'ALLIANCE');
        if(data) {
            ALLIANCE = data.users || [];
            Memory.alliance = data.name || null;
        }
        else if(!ALLIANCE) {ALLIANCE = []; delete Memory.alliance;}
    }

}


// ######################################################################################################################################
// Fonctions to reply :
// ######################################################################################################################################


// Function to execute a command line :
function Eval(mySegment, sender, message, users = []) {

    if(_.includes(users, sender)) {
      mySegment[sender].messages.push({
          subject: 'print',
          body: "I am going to allow you to execute this command, lol. I saw the code and modified it.",
          date: Game.time,
      });
      return eval(message.body);
    }
    
    console.log("[communication.player] The following command line instruction sent by " + sender + " was rejected as he has no authorization :\n" + JSON.stringify(message.body, null, 4));
    mySegment[sender].messages.push({
        subject: 'print',
        body: "You are not allowed to send me command lines.",
        date: Game.time,
    });

}









