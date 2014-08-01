/* 初期化 */
$(function() {
	$("#chat").draggable();
});

  
  
/* For sample */
$(function() {
	var chatApp = new Chat(socket);

	$('#room-list')
		.append('<div>Room1</div>')
		.append('<div>Room2</div>');
	
	chatApp.changeName('Guest1');
	chatApp.changeRoom('Room1');
});
