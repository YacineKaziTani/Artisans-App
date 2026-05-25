import "reflect-metadata";
import "dotenv/config";
import { DataSource } from "typeorm";
import { User } from "./modules/users/entities/user.entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false, //true
  logging: process.env.NODE_ENV === "development", // 'production'
  entities: [User],
  migrations: ["src/migrations/*.ts"],
});
