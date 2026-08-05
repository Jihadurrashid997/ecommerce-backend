import { CartProvider } from "./context/CartContext";

root.render(

<React.StrictMode>

<AppProvider>

<CartProvider>

<App/>

</CartProvider>

</AppProvider>

</React.StrictMode>

);
