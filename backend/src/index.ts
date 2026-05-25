import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./data-source";
import { User } from "./modules/users/entities/user.entities";
import cookieParser from "cookie-parser";
import cors from "cors";

async function bootstrap() {
  await AppDataSource.initialize();
  console.log("Database connected");

  const app = express();
  app.use(express.json());

  app.use(cookieParser());

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    }),
  );

  const userRepo = AppDataSource.getRepository(User);

  app.get("/users", async (_req, res) => {
    const users = await userRepo.find();
    res.json(users);
  });

  app.get("/users/:id", async (req, res) => {
    const user = await userRepo.findOneBy({ id: req.params.id });
    if (!user) return res.status(404).json({ error: "Not found" });
    res.json(user);
  });

  app.post("/users", async (req, res) => {
    try {
      const user = userRepo.create(req.body);
      await userRepo.save(user);
      res.status(201).json(user);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/users/:id", async (req, res) => {
    const result = await userRepo.delete(req.params.id);
    if (result.affected === 0)
      return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  });

  app.listen(3000, () => console.log("Listening on http://localhost:3000"));
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
