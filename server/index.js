// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Нужно для чтения POST-запросов
app.use(express.static(path.join(__dirname, '../client')));

// 🗃️ Работа с файлом-базой данных
const DATA_FILE = path.join(__dirname, 'data.json');
const readDB = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const saveDB = (data) => fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// 🤖 Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: {
    params: {
      allowed_updates: ['message', 'callback_query'] // Явно разрешаем получать сообщения с web_app_data
    }
  }
});
bot.on('polling_error', err => console.log('⚠️ Polling error:', err.message));

// Команда /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎟️ Добро пожаловать! У вас есть 3 бесплатных билета.\nНажмите кнопку:', {
    reply_markup: { inline_keyboard: [[{ text: '🎰 Открыть билет', web_app: { url: process.env.WEB_APP_URL } }]] }
  });
});

// 🎲 Генерация приза (с весами)
app.get('/api/ticket/generate', (req, res) => {
  const prizes = [
    { text: '🎁 10 монет', value: 10, weight: 50 },
    { text: '🎁 50 монет', value: 50, weight: 30 },
    { text: '🎁 100 монет', value: 100, weight: 15 },
    { text: '🎉 ДЖЕКПОТ: 500 монет', value: 500, weight: 5 }
  ];

  const rand = Math.random() * 100;
  let cumulative = 0;
  const selected = prizes.find(p => {
    cumulative += p.weight;
    return rand <= cumulative;
  }) || prizes[0];

  res.json({ prize: selected.text, value: selected.value });
});

// 💰 Начисление приза
// 💰 Начисление приза + уведомление от сервера
app.post('/api/user/claim', (req, res) => {
  const { userId, prizeValue } = req.body;
  if (!userId || prizeValue === undefined) return res.status(400).json({ error: 'Missing data' });

  const db = readDB();
  if (!db.users[userId]) db.users[userId] = { balance: 0, tickets: 3 };

  db.users[userId].balance += prizeValue;
  db.users[userId].tickets = Math.max(0, db.users[userId].tickets - 1);
  saveDB(db);

  // 🔹 СЕРВЕР САМ ПИШЕТ В ЧАТ (надёжнее, чем web_app_data)
  bot.sendMessage(userId, 
    `🎉 Приз зачислен!\n💰 Баланс: ${db.users[userId].balance} монет\n🎟️ Осталось билетов: ${db.users[userId].tickets}`
  ).catch(err => console.error('⚠️ Бот не смог отправить сообщение:', err.message));

  res.json({ 
    newBalance: db.users[userId].balance, 
    ticketsLeft: db.users[userId].tickets 
  });
});

// 📊 Получение баланса
app.get('/api/user/balance', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.json({ balance: 0, tickets: 0 });
  
  const db = readDB();
  const user = db.users[userId] || { balance: 0, tickets: 3 };
  res.json(user);
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер: http://localhost:${PORT}`);
  console.log(`🤖 Бот активен. Отправьте /start`);
});