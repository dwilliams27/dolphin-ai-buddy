import express from 'express';

export const server = () => {
  console.log("Starting Express server...");
  const app = express();
  const port = process.env.PORT || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.send('Hello World! Express server is running.');
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
