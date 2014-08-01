var socketio = require('socket.io');
var pg = require('pg');
var conString = "tcp://admin:admin@localhost:5432/chat_db"
var client = new pg.Client(conString);
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};
var cache = {};

exports.listen = function (server) {
    io = socketio.listen(server);
    io.set('log level', 1);
    io.sockets.on('connection', function (socket) {
        guestNumber = assignGuestName(socket, guestNumber, nickNames, namesUsed);
        joinRoom(socket, 'Lobby');
        handleMessageBroadcasting(socket, nickNames);
        handleLogin(socket, nickNames);
        handleAddUser(socket, nickNames);
        //handleUpdateUser(socket, nickNames);
        //handleDeleteUser(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        socket.on('rooms', function () {
            socket.emit('rooms', io.sockets.manager.rooms);
        });
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

// todo srever.jsとの共通化
function sendFile(res, filePath, fileContents) {
    res.writeHead(200, { "content-type" : mime.lookup(path.basename(filePath)) }
);
    res.end(fileContents);
}
function serveStatic(res, cache, absPath) {
    if (cache[absPath]) {
        sendFile(res, absPath, cache[absPath]);
    } else {
        fs.exists(absPath, function (exists) {
            if (exists) {
                fs.readFile(absPath, function (err, data) {
                    if (err) {
                        send404(res);
                    } else {
                        cache[absPath] = data;
                        sendFile(res, absPath, data);
                    }
                });
            } else {
                send404(res);
            }
        });
    }
}

function assignGuestName(socket, guestNumber, nickNames, namesUsed) {
    var name = 'Guest' + guestNumber;
    nickNames[socket.id] = name;
    socket.emit('nameResult', {
        success: true,
        name: name
    });
    namesUsed.push(name);
    return guestNumber + 1;
}

function joinRoom(socket, room) {
    socket.join(room);
    currentRoom[socket.id] = room;
    socket.emit('joinResult', { room: room });
    socket.broadcast.to(room).emit('message', {
        text: nickNames[socket.id] + ' has joined ' + room + '.'
    });

    var usersInRoom = io.sockets.clients(room);
    if (usersInRoom.length > 1) {
        var usersInRoomSummary = 'Users currently in ' + room + ': ';
        for (var index in usersInRoom) {
            var userSocketId = usersInRoom[index].id;
            if (userSocketId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ', ';
                }
                usersInRoomSummary += nickNames[userSocketId];
            }
        }
        usersInRoomSummary += '.';
        socket.emit('message', { text: usersInRoomSummary });
    }
}

function handleLogin(socket, nickNames) { 
    socket.on('login', function (name, password) {
        pg.connect(conString, function (err, client) {
                if (err) {
                    console.log(err);
                } else {
                    client.query('SELECT * FROM "CHAT_USER"', function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            for(var i = 0; i < result.rows.length; i++){
                                var row = result.rows[i];
                                var loginSuccessFlg = false;
                                if (row.UserName !== name) continue;
                                if(row.Password !== password) break;
                                loginSuccessFlg = true; // ユーザ名・パスワードが一致した場合
                                break;
                            }
                            if(loginSuccessFlg){
                                nickNames[socket.id] = name;
                                socket.emit('loginResult', {
                                    success: true,
                                    name: name
                                });
                                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                                    text: name + ' logined successfully .'
                                });
                            } else {
                                socket.emit('loginResult', {
                                    success: false,
                                    message: 'ユーザ名またはパスワードが一致しません'
                                });
                            }
                        }
                    })
            }
        });
    });
}

function handleAddUser(socket, nickNames) {
    socket.on('addUser', function (name, password) {
        pg.connect(conString, function (err, client) {
            if (err) {
                console.log(err);
            } else {
                client.query('INSERT INTO "CHAT_USER"\("UserId", "UserName", "Password"\) VALUES \($1, $2, $3\);', 
                    [name,name,password], function (err, result) {
                    if (err) {
                        console.log(err);
                    } else {
                        //for (var i = 0; i < result.rows.length; i++) {
                        //    var row = result.rows[i];
                        //    var loginSuccessFlg = false;
                        //    if (row.UserName !== name) continue;
                        //    if (row.Password !== password) break;
                        //    loginSuccessFlg = true; // ユーザ名・パスワードが一致した場合
                        //    break;
                        //}
                        //if (loginSuccessFlg) {
                        //    nickNames[socket.id] = name;
                        //    socket.emit('nameResult', {
                        //        success: true,
                        //        name: name
                        //    });
                        //    socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                        //        text: previousName + ' is now known as ' + name + '.'
                        //    });
                        //} else {
                            socket.emit('addUserResult', {
                                success: true,
                                message: 'ユーザの作成に成功しました'
                            });
                        //}
                    }
                })
            }
        });
    });
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    // コマンドを、login, createUser, updateUser, deleteUser の４つに分解する 
    socket.on('nameAttempt', function (name, password) {
        if (name.indexOf('Guest') == 0) {
            socket.emit('nameResult', {
                success: false,
                message: 'Names cannot begin with "Guest".'
            });
        } else {
            pg.connect(conString, function(err, client){ 
                if (err) {
                    console.log(err);
                } else {             
                    client.query('SELECT count("UserName") FROM chatUser Where "UserName" = $1 ', [name] , function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            if (result.rows[0].count === "0") {
                                // ユーザが存在しな場合は、そのユーザ名とパスワードをDBに登録する
                                var previousName = nickNames[socket.id];
                                var previousNameIndex = namesUsed.indexOf(previousName);
                                namesUsed.push(name);
                                nickNames[socket.id] = name;
                                delete namesUsed[previousNameIndex];
                                socket.emit('nameResult', {
                                    success: true,
                                    name: name
                                });
                                socket.broadcast.to(currentRoom[socket.id]).emit('message', {
                                    text: previousName + ' is now known as ' + name + '.'
                                });
                            } else {
                                // 同じユーザだからエラーではなく、パスワードをチェックして同じならOKとする
                                socket.emit('nameResult', {
                                    success: false,
                                    message: 'That name is already in use.'
                                });
                            }
                        }
                    })
                }
            });

        }
    });
}

function handleMessageBroadcasting(socket) {
    socket.on('message', function (message) {
        socket.broadcast.to(message.room).emit('message', {
            text: nickNames[socket.id] + ': ' + message.text
        });
    });
}

function handleRoomJoining(socket) {
    socket.on('join', function (room) {
        socket.leave(currentRoom[socket.id]);
        joinRoom(socket, room.newRoom);
    });
}

function handleClientDisconnection(socket) {
    socket.on('disconnect', function () {
        var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}
