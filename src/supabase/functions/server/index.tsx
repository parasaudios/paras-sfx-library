import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import * as sounds from "./sounds.tsx";
import * as suggestions from "./suggestions.tsx";
import * as tags from "./tags.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-27929102/health", (c) => {
  return c.json({ status: "ok" });
});

// Get all sounds
app.get("/make-server-27929102/sounds", async (c) => {
  try {
    const allSounds = await sounds.getAllSounds();
    return c.json({ success: true, sounds: allSounds });
  } catch (error) {
    console.error("Error fetching sounds:", error);
    return c.json({ success: false, error: "Failed to fetch sounds" }, 500);
  }
});

// Get single sound
app.get("/make-server-27929102/sounds/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const sound = await sounds.getSound(id);
    
    if (!sound) {
      return c.json({ success: false, error: "Sound not found" }, 404);
    }
    
    return c.json({ success: true, sound });
  } catch (error) {
    console.error("Error fetching sound:", error);
    return c.json({ success: false, error: "Failed to fetch sound" }, 500);
  }
});

// Create new sound
app.post("/make-server-27929102/sounds", async (c) => {
  try {
    const body = await c.req.json();
    const { title, audioUrl, tags, equipment, format } = body;
    
    if (!title || !audioUrl) {
      return c.json({ success: false, error: "Missing required fields (title and audioUrl)" }, 400);
    }
    
    const newSound = await sounds.createSound({
      title,
      audioUrl,
      tags: Array.isArray(tags) ? tags : [],
      equipment,
      format,
    });
    
    return c.json({ success: true, sound: newSound }, 201);
  } catch (error) {
    console.error("Error creating sound:", error);
    return c.json({ success: false, error: "Failed to create sound" }, 500);
  }
});

// Update sound
app.put("/make-server-27929102/sounds/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const updatedSound = await sounds.updateSound(id, body);
    
    if (!updatedSound) {
      return c.json({ success: false, error: "Sound not found" }, 404);
    }
    
    return c.json({ success: true, sound: updatedSound });
  } catch (error) {
    console.error("Error updating sound:", error);
    return c.json({ success: false, error: "Failed to update sound" }, 500);
  }
});

// Delete sound
app.delete("/make-server-27929102/sounds/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const success = await sounds.deleteSound(id);
    
    if (!success) {
      return c.json({ success: false, error: "Sound not found" }, 404);
    }
    
    return c.json({ success: true, message: "Sound deleted" });
  } catch (error) {
    console.error("Error deleting sound:", error);
    return c.json({ success: false, error: "Failed to delete sound" }, 500);
  }
});

// Get all suggestions
app.get("/make-server-27929102/suggestions", async (c) => {
  try {
    const allSuggestions = await suggestions.getAllSuggestions();
    return c.json({ success: true, suggestions: allSuggestions });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return c.json({ success: false, error: "Failed to fetch suggestions" }, 500);
  }
});

// Get single suggestion
app.get("/make-server-27929102/suggestions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const suggestion = await suggestions.getSuggestion(id);
    
    if (!suggestion) {
      return c.json({ success: false, error: "Suggestion not found" }, 404);
    }
    
    return c.json({ success: true, suggestion });
  } catch (error) {
    console.error("Error fetching suggestion:", error);
    return c.json({ success: false, error: "Failed to fetch suggestion" }, 500);
  }
});

// Create new suggestion
app.post("/make-server-27929102/suggestions", async (c) => {
  try {
    const body = await c.req.json();
    const { soundName, category, description } = body;
    
    if (!soundName) {
      return c.json({ success: false, error: "Missing required field (soundName)" }, 400);
    }
    
    const newSuggestion = await suggestions.createSuggestion({
      soundName,
      category: category || '',
      description: description || '',
      submittedAt: new Date().toISOString(),
      isRead: false,
    });
    
    return c.json({ success: true, suggestion: newSuggestion }, 201);
  } catch (error) {
    console.error("Error creating suggestion:", error);
    return c.json({ success: false, error: "Failed to create suggestion" }, 500);
  }
});

// Update suggestion
app.put("/make-server-27929102/suggestions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const updatedSuggestion = await suggestions.updateSuggestion(id, body);
    
    if (!updatedSuggestion) {
      return c.json({ success: false, error: "Suggestion not found" }, 404);
    }
    
    return c.json({ success: true, suggestion: updatedSuggestion });
  } catch (error) {
    console.error("Error updating suggestion:", error);
    return c.json({ success: false, error: "Failed to update suggestion" }, 500);
  }
});

// Delete suggestion
app.delete("/make-server-27929102/suggestions/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const success = await suggestions.deleteSuggestion(id);
    
    if (!success) {
      return c.json({ success: false, error: "Suggestion not found" }, 404);
    }
    
    return c.json({ success: true, message: "Suggestion deleted" });
  } catch (error) {
    console.error("Error deleting suggestion:", error);
    return c.json({ success: false, error: "Failed to delete suggestion" }, 500);
  }
});

// Get all tags
app.get("/make-server-27929102/tags", async (c) => {
  try {
    const allTags = await tags.getAllTags();
    console.log('Fetched tags successfully:', allTags);
    return c.json({ success: true, tags: allTags });
  } catch (error) {
    console.error("Error fetching tags:", error);
    // Return empty array instead of error to prevent frontend issues
    return c.json({ success: true, tags: [] });
  }
});

// Set all tags (replace entire tag list)
app.put("/make-server-27929102/tags", async (c) => {
  try {
    const body = await c.req.json();
    const { tags: newTags } = body;
    
    if (!Array.isArray(newTags)) {
      return c.json({ success: false, error: "Tags must be an array" }, 400);
    }
    
    await tags.setTags(newTags);
    const updatedTags = await tags.getAllTags();
    
    return c.json({ success: true, tags: updatedTags });
  } catch (error) {
    console.error("Error setting tags:", error);
    return c.json({ success: false, error: "Failed to set tags" }, 500);
  }
});

// Add a single tag
app.post("/make-server-27929102/tags", async (c) => {
  try {
    const body = await c.req.json();
    const { tag } = body;
    
    if (!tag || typeof tag !== 'string') {
      return c.json({ success: false, error: "Tag must be a non-empty string" }, 400);
    }
    
    const updatedTags = await tags.addTag(tag);
    return c.json({ success: true, tags: updatedTags });
  } catch (error) {
    console.error("Error adding tag:", error);
    return c.json({ success: false, error: error.message || "Failed to add tag" }, 400);
  }
});

// Remove a single tag
app.delete("/make-server-27929102/tags/:tag", async (c) => {
  try {
    const tag = c.req.param("tag");
    const updatedTags = await tags.removeTag(tag);
    
    return c.json({ success: true, tags: updatedTags });
  } catch (error) {
    console.error("Error removing tag:", error);
    return c.json({ success: false, error: "Failed to remove tag" }, 500);
  }
});

Deno.serve(app.fetch);