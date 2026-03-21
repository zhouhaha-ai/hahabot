import { render, screen } from "@testing-library/react";

import { App } from "./App";

it("renders the empty chat shell", async () => {
  render(<App />);

  expect(await screen.findByText(/new chat/i)).toBeInTheDocument();
  expect(screen.getByText(/start a conversation/i)).toBeInTheDocument();
});
