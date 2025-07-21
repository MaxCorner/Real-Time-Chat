const socket = io();

const username = prompt("Enter your username:") || "Anonymous";
const room = prompt("Enter room name:") || "1";

socket.emit('join room', { username, room });

const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});

socket.on('chat history', (history) => {
  history.forEach(data => {
    addMessage(data);
  });
});

socket.on('chat message', (data) => {
  addMessage(data);
});

function addMessage(data) {
  const li = document.createElement('li');
  li.textContent = `${data.username}: ${data.message}`;
  messages.appendChild(li);
  window.scrollTo(0, document.body.scrollHeight);
}
