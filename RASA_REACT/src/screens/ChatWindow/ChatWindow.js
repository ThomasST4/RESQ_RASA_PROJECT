import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import io from 'socket.io-client';
import { GiftedChat } from 'react-native-gifted-chat';
import TopNavigationBar from '../../../components/TopNavigationBar';
import { rasaServerSocket, pythonServerSocket } from '../../../components/SocketManager/SocketManager';
import { useNavigation, useRoute } from '@react-navigation/native';

const ChatWindowScreen = () => {
  const route = useRoute();
  const { username } = route.params;
  const [userUUID, setUserUUID] = useState('');
  const [messages, setMessages] = useState([]); // State to store chat messages
  //const [socket, setSocket] = useState(null); // State to manage the WebSocket connection
  const [isLoading, setIsLoading] = useState(false); // State to control typing indicator
  const [socketId, setSocketId] = useState(''); // State to store the socket ID

  const generateUUID = () => {
    // Generate a random part of the UUID
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);

    // Return a formatted UUID
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
  };

  // Function to simulate a typing delay for bot responses
  const simulateTypingDelay = (message, delay) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(message);
      }, delay);
    });
  };

  const sendDataThroughDataSocket = (message, messageId, isSystemMessage, messageType) => {
    // Emit the data using the existing socket connection
    const dataSocket = io('http://172.31.156.13:5006');
    dataSocket.emit('message_from_client', { uuid: userUUID, username: username, message: message, messageId: messageId, isSystemMessage: isSystemMessage, messageType: messageType });
  };

  useEffect(() => {
    // Create a new WebSocket connection to the Rasa server
    //const socket = io('http://172.31.156.13:5005');
    //const superSocket = io('http://172.31.156.13:5006');

    // Handle WebSocket connection events
    rasaServerSocket.on('connect', () => {
      console.log(rasaServerSocket.id + ' Connected to server');
      pythonServerSocket.emit('fetch_user_information', username);
      setSocketId(rasaServerSocket.id);
    });

    rasaServerSocket.on('disconnect', () => {
      console.log(rasaServerSocket.id + ' Disconnected from server');
    });

    pythonServerSocket.on('user_information_fetched', (data) => {
      const { fetchedUsername, fetchedUUID } = data;
      setUserUUID(fetchedUUID);
      console.log('USER UUID: ' + fetchedUUID)
      // Use fetchedUsername and fetchedUUID in your React component
    });

    // Handle incoming messages from the bot
    rasaServerSocket.on('bot_uttered', async (data) => {

      const botText = data.text;
      const messageId = generateUUID();

      const botMessage = {
        _id: messageId,
        text: botText,
        createdAt: new Date(),
        user: { _id: 'bot' },
      };

      // Show a typing indicator (optional)
      setIsLoading(true);

      // Simulate a typing delay (e.g., 500 milliseconds) before displaying the bot's message
      const typingDelay = 500;

      // Simulate the typing delay
      const delayedBotMessage = await simulateTypingDelay(botMessage, typingDelay);

      // Calculate the time it took for the bot's message to arrive
      const botMessageReceivedTime = new Date();
      const messageLatency = botMessageReceivedTime - botMessage.createdAt;
      console.log('Message latency:', messageLatency, 'ms');

      // Append the bot's message to the chat messages
      setMessages((previousMessages) =>
        GiftedChat.append(previousMessages, [delayedBotMessage])
      );

      // Remove the typing indicator (optional)
      setIsLoading(false);

      sendDataThroughDataSocket(botText, messageId, "False", "Bot Answer");

    });

    // Clean up the WebSocket connection when the component unmounts
    return () => {
      rasaServerSocket.disconnect();
    };
  }, []);

  // Function to manually append a message to the chat
  const appendMessageToChat = (newMessage) => {
    setMessages((previousMessages) => GiftedChat.append(previousMessages, newMessage));
  }

  // Function to handle sending user messages
  const onSend = (newMessages) => {
    setMessages((previousMessages) =>
      GiftedChat.append(previousMessages, newMessages)
    );

    const text = newMessages[0].text;

    if (rasaServerSocket && rasaServerSocket.connected) {
      if (text.trim() !== '') {
        setIsLoading(true);

        const messageId = generateUUID();

        const newMessage = {
          _id: messageId,
          text: text,
          createdAt: new Date(),
          user: {
            _id: rasaServerSocket.id,
          },
        };

        // Log the message being sent to Rasa
        console.log('Sending message to Rasa:', newMessage);

        // Record the time before sending the message
        const messageSentTime = new Date();

        // Emit the user's message to Rasa
        rasaServerSocket.emit('user_uttered', { session_id: rasaServerSocket.id, message: text }, () => {
          // Calculate the time it took for the message to be acknowledged
          const acknowledgmentTime = new Date() - messageSentTime;
          console.log('Acknowledgment time:', acknowledgmentTime, 'ms');

          // Continue with the rest of the code
          setIsLoading(false);

          sendDataThroughDataSocket(text, messageId, "False", "Question")

        });
      } else {
        // Example of how to use the appendMessageToChat function
        const newMessage = {
          _id: generateUUID(),
          text: 'Din besked er tom',
          createdAt: new Date(),
          user: { _id: 'bot' },
        };

        appendMessageToChat(newMessage);
      }
    } else {
      // Example of how to use the appendMessageToChat function
      const newMessage = {
        _id: generateUUID(),
        text: 'Du er ikke tilsluttet til serveren',
        createdAt: new Date(),
        user: { _id: 'bot' },
      };

      appendMessageToChat(newMessage);
    }
  };

  // Function to render the avatar based on the user or bot
  const renderAvatar = (props) => {
    const { currentMessage } = props;

    if (currentMessage.user._id === 'bot') {
      // Path to the bot's avatar image
      const botAvatarPath =
        Platform.OS === 'android'
          ? require('../../../assets/bot.png') // Android
          : require('../../../assets/bot.png'); // iOS

      return (
        <Image
          source={botAvatarPath}
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
      );
    };
  };
  return (
    <View style={styles.container}>
      <TopNavigationBar username={username} />
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={{ _id: socketId }}
        isTyping={isLoading}
        renderAvatar={renderAvatar}
      />
    </View>
  );
}

/*
<GiftedChat
  messages={messages}
  onSend={onSend}
  user={{ _id: socketId }}
  isTyping={isLoading}
  renderAvatar={renderAvatar}
/>
 
<SignInScreen />
*/



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FBFC',
  },
  rasaTypingIndicator: {
    color: 'black',
    fontSize: 18,
    alignSelf: 'center',
    marginVertical: 8,
  },
});

export default ChatWindowScreen;
