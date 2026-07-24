import axios from 'axios';

const API = axios.create({
  baseURL: 'https://ecommerce-api-9wc9.onrender.com/api', // আপনার রেন্ডারের লাইভ বেস ইউআরএল
});

export default API;