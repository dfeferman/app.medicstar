import { syncProducts } from "./syncProducts";

setInterval(() => {
  console.log("Worker is running");

  syncProducts().catch(console.error);
}, 1000 * 30);


