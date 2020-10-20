const ws = require('nodejs-websocket')
const arr = {} //方便管理连接
/**userArr记录每个桌号的信息
如下形式:数字代表桌号,对象表示该桌号的数据
reBeginNum为2表示两个玩家都点击了重新开始
users数组代表该桌上的玩家用户名
times表示该桌的盘数
{
    0: {
        reBeginNum: 0,
        users: ['zhangsan', 'lisi'],
        times: 0
    }
}
*/
let userArr = {}
const colorArr1 = ['black', 'white']
const colorArr2 = ['white', 'black']

//index桌号
function getColorArr (index) {
  userArr[index].times++
  if (userArr[index].times % 2 === 1) {
    return colorArr1
  } else {
    return colorArr2
  }
}

//发送对手名字
function sendOther(zhuohao) {
  for (let i = 0; i < userArr[zhuohao].users.length; i++) {
    let name = userArr[zhuohao].users[i]
    arr[name].sendText(JSON.stringify({
      code: 208, //设置发送对手名字的code为208
      username: name,
      text: userArr[zhuohao].users[1 - i] //对手的名字
    }))
  }
}

//发送对手信息和棋子颜色
function sendQZColor(zhuohao) {
  let colorArr = getColorArr(zhuohao)
  for (let i = 0; i < userArr[zhuohao].users.length; i++) {
    let name = userArr[zhuohao].users[i]
    arr[name].sendText(JSON.stringify({
      code: 202, //设置发送对手名字和棋子颜色的code为202
      username: name,
      text: userArr[zhuohao].users[1 - i], //对手的名字
      qz: colorArr[i] //棋子颜色
    }))
  }
}

//向所有玩家发送桌子情况
function sendQingkuang () {
  let zhuoziqingkuang = {}
  for (let zhuo in userArr) {
    if (userArr[zhuo] && userArr[zhuo].users.length > 0) {
      zhuoziqingkuang[zhuo] = userArr[zhuo].users
    }
  }
  for (let item in arr) { //向所有用户发送桌子占用情况
    arr[item].sendText(JSON.stringify({ //发消息只能是字符串或者buffer
      code: 206,  //发送桌子占用情况设为206
      username: item,
      text: zhuoziqingkuang
    }))
  }
}

//获取所有连接服务器的玩家用户名
function getConnectedMan() {
  let manArr = []
  for (let item in arr) {
    manArr.push(item)
  }
  return manArr
}

const server = ws.createServer(function(socket) {
  socket.on('text', function(str) { //nodejs-websocket框架监听的是text
    let data = JSON.parse(str)
    let username = data.username
    let zhuohao = data.zhuohao
    let mes = data.mes
    console.log('服务器收到了来自', username, '的消息:', mes, ',桌号是:', zhuohao)
    /**
    收到的data.mes的消息:
    link: 连接服务器
    sitdown: 选桌子坐下
    situp: 离开桌子
    close: 关闭连接
    reBegin: 重新开局
    huiqi: 悔棋
    wantToHuiqi: 请求悔棋
    okToHuiqi: 对手同意悔棋
    发送给客户端的信息:
    code: 200 发送连接成功字符串
    code: 202 发送对手名字和棋子颜色
    code: 204 发送棋子位置
    code: 206 发送桌子占用情况
    code: 208 发送对手名字
    code: 210 悔棋
    code: 212 询问是否允许对方悔棋设为
    code: 214 同意悔棋设为
    code: 500 发送连接失败字符串
    */
    if (mes === 'link') { //连接
      arr[username] = socket
      sendQingkuang()
    } else if (mes === 'sitdown') { //选桌子桌下
      if (!userArr[zhuohao]) { //创建桌子信息
        userArr[zhuohao] = {
          reBeginNum: 0,
          users: [],
          times: 0
        }
      } else {
        userArr[zhuohao].reBeginNum = 0
        userArr[zhuohao].times = 0
      }
      if (userArr[zhuohao].users.length < 2) {
        userArr[zhuohao].users.push(username)
        socket.sendText(JSON.stringify({ //发送连接成功字符串
          code: 200,
          username: username,
          text: '连接成功'
        }))
        if (userArr[zhuohao].users.length === 2) { //如果2个用户齐了,就通知另一个用户
          sendOther(zhuohao)
        }
      } else {
        console.log('该桌玩家已满,请换一桌进行游戏')
        socket.sendText(JSON.stringify({ //发送字符串
          code: 500,
          username: username,
          text: '连接失败,每桌只能连接2个用户'
        }))
      }
      sendQingkuang()
    } else if (mes === 'situp') { //离开桌子
      userArr[zhuohao].users.forEach((user, index) => {
        if (user === username) {
          userArr[zhuohao].users.splice(index, 1)
        }
      })
      sendQingkuang()
    } else {
      if (arr[username]) {
        if (mes === 'close') { //如果是关闭连接的消息,就从数组删除该用户
          if (userArr[zhuohao]) {
            userArr[zhuohao].users.forEach((user, index) => {
              if (user === username) {
                userArr[zhuohao].users.splice(index, 1)
              }
            })
          }
          delete arr[username]
          return
        }
        if (mes === 'reBegin') { //重新开始一局
          userArr[zhuohao].reBeginNum++
          if (userArr[zhuohao].reBeginNum === 2) { //如果该桌号的2个用户都点击了重新开始
            sendQZColor(zhuohao)
            userArr[zhuohao].reBeginNum = 0
          }
          return
        }
        if (mes === 'wantToHuiqi') { //请求悔棋
          userArr[zhuohao].users.forEach(item => {
            if (item !== username) {
              arr[item].sendText(JSON.stringify({
                code: 212, //询问是否允许对方悔棋设为212
                username: item,
                text: data.huiqiColor
              }))
            }
          })
          return
        }
        if (mes === 'okToHuiqi') { //对手同意悔棋
          userArr[zhuohao].users.forEach(item => {
            if (item !== username) {
              arr[item].sendText(JSON.stringify({
                code: 214, //同意悔棋设为214
                username: item,
                text: data.huiqiColor
              }))
            }
          })
          return
        }
        if (mes === 'huiqi') { //悔棋
          userArr[zhuohao].users.forEach(item => { //给该桌号的玩家发送悔棋信息
            arr[item].sendText(JSON.stringify({ //发消息只能是字符串或者buffer
              code: 210, //悔棋设为210
              username: item,
              text: data.huiqiColor
            }))
          })
          return
        }
        userArr[zhuohao].users.forEach(item => { //给该桌号的玩家发送棋子位置信息
          arr[item].sendText(JSON.stringify({ //发消息只能是字符串或者buffer
            code: 204, //发送棋子位置设为204
            username: item,
            text: mes
          }))
        })
      }
    }
    console.log('桌子信息:', userArr)
    console.log('连接的用户:', getConnectedMan())
  })

  socket.on('close', function (code, reason) {
    console.log("关闭连接")
    console.log('桌子信息:', userArr)
    console.log('连接的用户:', getConnectedMan())
  })

  socket.on('error', function (code, reason) {
    console.log("异常关闭")
    console.log('桌子信息:', userArr)
    console.log('连接的用户:', getConnectedMan())
  })
}).listen(4000)