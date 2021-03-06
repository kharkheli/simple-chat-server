const User = require('../models/user')
const express = require('express')
const router = express.Router()
const randomImage = require('./randomImages')
const messageSchema = require('../models/message')
const mongoose = require('mongoose')

const logIn = async (req, res) => {
  const { username } = req.body
  //first we check if the user already exists
  let user = await User.findOne({ username })
  if (!user) {
    //if user with the given username doesn't exists we create one and send data
    user = await User.create({ username, img: randomImage() })
    return res.status(201).json({
      msg: 'welcome aboard ',
      username: user.username,
      friends: user.friends,
      img: user.img,
    })
  }

  //if user already exists we send data right away
  res.status(200).json({
    msg: 'welcome back ',
    username: user.username,
    friends: user.friends,
    img: user.img,
  })
}

const allUsers = async (req, res) => {
  const { starter, username } = req.query
  const limit = +req.query.limit || 10
  const skip = +req.query.skip || 0
  const friends = (await User.findOne({ username }).select('friends')).friends
  friends.push(username)
  const re = new RegExp(`^${starter}`)
  const users = await User.find({
    $and: [{ username: { $nin: friends } }, { username: re }],
  })
    .limit(limit)
    .skip(skip)
  res.status(200).json([...users])
}

const addFriend = async (req, res) => {
  const { user, friend } = req.body
  await User.findOneAndUpdate(
    { username: user },
    { $addToSet: { friends: friend } },
  )
  await User.findOneAndUpdate(
    { username: friend },
    { $addToSet: { friends: user } },
  )
  res.status(200).json({ msg: 'ok' })
}

const getFriend = async (req, res) => {
  const { user: username } = req.params
  const { requester } = req.query
  const user = await User.findOne({ username })
  if (requester) {
    const chatname = [username, requester].sort().join('+')
    const chat = mongoose.model(chatname, messageSchema)
    let messages = await chat.find({})
    return res.status(200).json({ user: user, messages })
  }

  res.status(200).json(user)
}
const getFriends = async (req, res) => {
  const { requester, usernames } = req.query
  const user = await User.find({ username: { $in: usernames } })
  const friends = []
  for (const friend of user) {
    const chatname = [friend.username, requester].sort().join('+')

    const chat = mongoose.model(chatname, messageSchema)
    let messages = await chat.find({}).sort({ time: -1 }).limit(10)
    messages.sort((a, b) => {
      return a.time - b.time
    })
    friends.push({ user: friend, messages })
  }
  res.status(200).json({ friends: friends })
}
const loadMessages = async (req, res) => {
  const { limit, skip, user, friend } = req.query
  const chatname = [friend, user].sort().join('+')

  const chat = mongoose.model(chatname, messageSchema)
  let messages = await chat
    .find({})
    .sort({ time: -1 })
    .limit(+limit)
    .skip(+skip)
  messages.sort((a, b) => {
    return a.time - b.time
  })
  res.status(200).json({ messages: messages })
}

router.route('/log-in').post(logIn)
router.route('/').get(allUsers).patch(addFriend)
router.route('/friends').get(getFriends)
router.route('/messages').get(loadMessages)
router.route('/:user').get(getFriend)

module.exports = router
