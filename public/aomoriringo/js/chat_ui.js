function divEscapedContentElement(message) {
  return $('<div></div>').text(message);
}

function divSystemContentElement(message) {
  return $('<div class="system-message"></div>').html('<i>' + message + '</i>');
}

function divEffectElement(message) {
  if (getRandomBool(4)){
    return $('<div class="ef"></div>').text(message);
  }
  else {
    return $('<div class="ef rainbow"></div>').text(message);
  }
}

function divUsernameElement(username) {
  return $('<div class="username"></div>').text(username);
}

function getRandomBool(num) {
  // 2 の場合, true/falseが同確率
  // 3 の場合, true:false = 2:1 の確率
  if (typeof num === 'undefined'){
    num = 2;
  }
  return Boolean(Math.floor(Math.random() * num));
}

function getRandomAnimateEffectIn() {
  var effects = ['flash','bounce','shake','tada',
                 'rotateIn', 'bounceIn', 'fadeIn',
                 'fadeUp', 'fadeInDown', 'fadeInLeft',
                 'fadeInRight', 'fadeUpBig', 'fadeInDownBig',
                 'fadeInLeftBig', 'fadeInRightBig',
                 'bounceInDown','bounceInUp','bounceInLeft','bounceInRight',
                 'rotateInDownLeft','rotateInDownRight','rotateInUpLeft','rotateInUpRight'];
  return effects[Math.floor(Math.random()*effects.length)]
}

function getRandomAnimateEffectOut() {
  var effects = ['flash', 'bounce', 'shake', 'tada',
                 'rotateOut', 'bounceOut', 'fadeOut',
                 'fadeOut','fadeOutUp','fadeOutDown',
                 'fadeOutLeft','fadeOutRight','fadeOutUpBig',
                 'fadeOutDownBig','fadeOutLeftBig','fadeOutRightBig',
                 'rotateOutDownLeft','rotateOutDownRight','rotateOutUpLeft','rotateOutUpRight'];
  return effects[Math.floor(Math.random()*effects.length)]
}

function executeEffect() {
  $('.ef').textillate({
    // たまにループする
    loop: !getRandomBool(7),
    minDisplayTime: 2000,
    initialDelay: 0,
    autoStart: true,
    in: {
      effect: getRandomAnimateEffectIn(),
      // 2.0 ～ 20.0
      delayScale: Math.random()*18 + 2,
      // 2.0 ～ 20.0
      delay: Math.random()*18 + 2,
      sync: getRandomBool(),
      shuffle: getRandomBool()
    },
    out: {
      effect: getRandomAnimateEffectOut(),
      delayScale: Math.random()*18 + 2,
      delay: Math.random()*90 + 10,
      sync: getRandomBool(),
      shuffle: getRandomBool()
    }
  });
  $('.rainbow').animate({color: '#fff'}, 200)
               .animate({color: '#ff0'}, 200)
               .animate({color: '#f00'}, 200)
               .animate({color: '#f0f'}, 200)
               .animate({color: '#00f'}, 200)
               .animate({color: '#0ff'}, 200)
               .animate({color: '#fff'}, 200);
}

function processUserInput(chatApp, socket) {
  var message = $('#send-message').val();
  var systemMessage;

  if (message.length == 0) {
    return;
  }

  if (message.charAt(0) == '/') {
    systemMessage = chatApp.processCommand(message);
    if (systemMessage) {
      $('#messages').append(divSystemContentElement(systemMessage));
    }
  } else {
    chatApp.sendMessage($('#room').text(), message);
    printMessage(message, chatApp.username);
    $('#messages').scrollTop($('#messages').prop('scrollHeight'));
  }

  $('#send-message').val('');
}

function printMessage(message, username){
  $('#messages').append(divUsernameElement(username));
  $('#messages').append(divEffectElement(message));
  executeEffect();
}

var socket = io.connect();

$(document).ready(function() {
  var chatApp = new Chat(socket);

  socket.on('nameResult', function(result) {
    var message;

    if (result.success) {
      chatApp.username = result.name;
      message = 'You are now known as ' + chatApp.username + '.';
    } else {
      message = result.message;
    }
    $('#messages').append(divSystemContentElement(message));
  });

  socket.on('joinResult', function(result) {
    $('#room').text(result.room);
    $('#messages').append(divSystemContentElement('Room changed.'));
  });

  socket.on('message', function (message) {
    printMessage(message.text, message.username);
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
});
