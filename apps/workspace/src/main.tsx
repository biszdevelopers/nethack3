import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { NethackProvider } from "@nethack/ui";
import { queryClient } from "./application/query-client.js";
import { router } from "./application/router.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
    throw new Error("The application root element is missing.");
}

createRoot(container).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <NethackProvider>
                <RouterProvider router={router} />
            </NethackProvider>
        </QueryClientProvider>
    </StrictMode>,
);
