import { render, screen } from "@testing-library/react";

import { App } from "./App";

it("renders the empty chat shell", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /哈哈chatbot/i })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /新聊天/i })).toBeInTheDocument();
  expect(screen.getByText(/今天我能帮你做些什么/i)).toBeInTheDocument();
  expect(screen.getByText(/总结文本/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/问问哈哈吧/i)).toBeInTheDocument();
});
