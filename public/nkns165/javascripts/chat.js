var Chat = function(socket) {
  this.socket = socket;
};

Chat.prototype.sendMessage = function(room, text) {
  var message = {
    room: room,
    text: text
  };
  this.socket.emit('message', message);
};

Chat.prototype.changeRoom = function(room) {
  this.socket.emit('join', {
    newRoom: room
  });
};

//Chat.prototype.requestLog = function (room) {
//    this.socket.emit('requestLog', {
//    });
//};

Chat.prototype.processCommand = function(command) {
  var words = command.split(' ');
  var command = words[0]
                .substring(1, words[0].length)
                .toLowerCase();
  var message = false;

  switch(command) {
    case 'join':
      words.shift();
      var room = words.join(' ');
      this.changeRoom(room);
      break;
    case 'login':
      words.shift();
            var name = words[0];
            var password = words[1];
      this.socket.emit('login', name, password);
      break;
    case 'adduser':
        words.shift();
            var name = words[0];
            var password = words[1];
        this.socket.emit('addUser', name, password);
        break;
    case 'updateuser':
        words.shift();
            var name = words[0];
            var password = words[1];
        this.socket.emit('updateUser', name, password);
        break;
    case 'deleteuser':
        words.shift();
            var name = words[0];
            var password = words[1];
        this.socket.emit('deleteUser', name, password);
        break;
    default:
      message = 'Unrecognized command.';
      break;
  };

  return message;
};
