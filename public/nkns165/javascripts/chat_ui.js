function divEscapedContentElement(message) {
  return $('<div></div>').text(message);
}

function divSystemContentElement(message) {
  return $('<div></div>').html('<i>' + message + '</i>');
}

function processUserInput(chatApp, socket) {
  var message = $('#send-message').val();
  var systemMessage;

  if (message.charAt(0) == '/') {
    systemMessage = chatApp.processCommand(message);
    if (systemMessage) {
      $('#messages').append(divSystemContentElement(systemMessage));
    }
  } else {
    chatApp.sendMessage($('#room').text(), message);
    $('#messages').append(divEscapedContentElement(message).addClass('self-message'));
    $('#messages').scrollTop($('#messages').prop('scrollHeight'));
  }

  $('#send-message').val('');
}

var socket = io.connect();

$(document).ready(function () {
    var chatApp = new Chat(socket);

    socket.on('nameResult', function (result) {
        var message;
        
        if (result.success) {
            message = 'You are now known as ' + result.name + '.';
        } else {
            message = result.message;
        }
        if ($('#chat').is(':visible')) {
            $('#messages').append(divSystemContentElement(message));
        }
    });

    socket.on('addUserResult', function (result) {
       var message;
       if (result.success) {
           chatApp.processCommand('/login ' + result.userName + ' ' + $('#login-pw').val());
       } else {
           $('#login-message').append(divSystemContentElement(result.message));
       }
    });
    
    socket.on('loginResult', function (result) {
        var message;
        
        if (result.success) {
            message = 'Welcome! ' + result.name + '.';
            $('#login-parts').hide();
            $('#chat').show();
            $('#messages').append(divSystemContentElement(message));
        } else {
            $('#login-message').append(divSystemContentElement(result.message));
        }
    });

  socket.on('joinResult', function(result) {
    $('#room').text(result.room);
      if ($('#chat').is(':visible')) {
          $('#messages').append(divSystemContentElement('Room changed.'));
      }
  });

  socket.on('message', function (message) {
    var text = message.text;
    if (message.userName !== undefined) {
        text = message.userName + ' : ' + text;
    }
    var newElement = $('<div></div>').text(text);
    $('#messages').append(newElement);
  });

  socket.on('rooms', function(rooms) {
    $('#room-list').empty();

    for(var room in rooms) {
      room = room.substring(1, room.length);
      if (room != '') {
        $('#room-list').append(divEscapedContentElement(room));
      }
    }

    $('#room-list div').click(function() {
      chatApp.processCommand('/join ' + $(this).text());
      $('#send-message').focus();
    });
  });

  setInterval(function() {
    socket.emit('rooms');
  }, 1000);

  $('#send-message').focus();

  $('#send-form').submit(function() {
    processUserInput(chatApp, socket);
    return false;
  });

   $('#send-message-btn').click(function() {
       processUserInput(chatApp, socket);
       return false;
   });

  $('#signup').click(function() {
      chatApp.processCommand('/addUser ' + $('#login-id').val() + ' ' + $('#login-pw').val());
  });

  $('#login').click(function() {
      chatApp.processCommand('/login ' + $('#login-id').val() + ' ' + $('#login-pw').val());
  });
});
