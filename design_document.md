# **HamFlow: The Personalized Productivity Hub**

## **1\. Vision & Core Principles**

**Vision:** To create a centralized, intelligent command center for your digital life that seamlessly integrates with your existing infrastructure (HamCloud, HamBot, Notes Server). HamFlow will reduce friction between thought and action, combat forgetfulness through smart automation, and provide clear separation between different life contexts.

**Core Principles:**

* **Frictionless Input:** Capture tasks, ideas, and events as quickly as possible using voice, text, or calendar events. The system should understand you.  
* **Intelligent Automation:** The system should work for you. Reminders, recurring tasks, and notifications should be handled automatically by HamBot based on your rules.  
* **Contextual Separation:** Maintain a clear and fluid boundary between "Work" and "Personal" contexts, preventing cognitive overload and improving focus.  
* **Seamless Integration:** Act as the central nervous system, connecting your authentication, database, notification bot, and knowledge base into a single, cohesive experience.

## **2\. System Architecture**

HamFlow will be a single-page application (SPA) with a real-time backend. The architecture leverages your existing services.

* **Frontend (React):** A dynamic and responsive user interface built with React. It will handle all user interactions, state management, and real-time updates via WebSockets.  
* **Backend (ElysiaJS):** A high-performance Bun-based backend server. It will manage business logic, API endpoints, WebSocket connections, and communicate with your other services.  
* **Database (Postgres via HamCloud):** Your HamCloud instance will provide the primary Postgres database for storing all user data like tasks, boards, settings, etc.  
* **Authentication (HamCloud):** All user authentication and session management will be handled by your existing HamCloud auth service. The frontend will receive a JWT or similar token to interact with the backend.  
* **Notifications (HamBot):** When a reminder or notification is triggered, the Elysia backend will make an API call to HamBot, instructing it to send a message to the user's configured social networks (Discord, Slack, etc.).  
* **Knowledge Base (Notes Server):** Tasks and projects within HamFlow can be linked to detailed documents on your Notes Server. The backend will interact with the Notes Server's API to create or retrieve these links.

## **3\. Detailed Feature Breakdown**

### **3.1. Work & Personal Spaces (The Foundation)**

* **Description:** The entire application will be divided into two distinct, high-level contexts: "Work" and "Personal". Switching between them changes every view—Kanban boards, calendar events, tasks, etc. This is the core feature for achieving work-life separation.  
* **Implementation:**  
  * The UI will feature a prominent, easily accessible toggle to switch between spaces.  
  * In the database, every major data table (boards, tasks, etc.) will have a space column ('work' or 'personal').  
  * All API queries will be filtered by the currently active space.

### **3.2. The Unified Kanban Board**

* **Description:** A flexible, visual way to manage projects and tasks. Users can create multiple boards within each space (e.g., "Project X," "Content Pipeline" for Work; "Home Renovations," "Vacation Planning" for Personal).  
* **Features:**  
  * Draggable cards (tasks) and columns (stages, e.g., To Do, In Progress, Done).  
  * Cards will display title, due date, priority, and icons indicating a linked note or reminder.  
  * Clicking a card opens a detailed view.  
* **Implementation:**  
  * **DB Schema:**  
    * boards (id, name, space, column\_order)  
    * columns (id, board\_id, name, task\_order)  
    * tasks (id, column\_id, title, description, due\_date, priority, note\_id, created\_at)  
  * **Backend:** REST endpoints for CRUD operations on boards, columns, and tasks.  
  * **Frontend:** Use a library like react-beautiful-dnd for drag-and-drop functionality. State updates will be sent to the backend via API and broadcast to other clients via WebSockets for multi-device sync.

### **3.3. Direct Calendar Integration (Two-Way Sync)**

* **Description:** Integrate directly with your primary calendar (e.g., Google Calendar, Outlook) to sync events and task deadlines.  
* **Features:**  
  * Tasks with a due\_date in HamFlow will automatically appear on your external calendar.  
  * Events from your external calendar will appear in a "Today" or "Agenda" view within HamFlow.  
  * (Optional V2) Create a HamFlow task directly from a calendar event.  
* **Implementation:**  
  * **Backend:** Use OAuth 2.0 to securely connect to the user's Google/Microsoft account. Implement API logic for fetching events and creating/updating events on the user's calendar.  
  * **DB Schema:** A calendar\_integrations table to store OAuth tokens securely.  
  * **Frontend:** A settings page to manage calendar connections. An "Agenda" view to display a mix of tasks and calendar events.

### **3.4. AI Command & Voice Input**

* **Description:** A central "command bar" or a floating action button that accepts natural language commands via text or voice. This is the "frictionless input" core.  
* **Example Commands:**  
  * "Add task 'Deploy the staging server' to my work project board for tomorrow at 10 am."  
  * "Remind me to call the dentist in 30 minutes."  
  * "What's on my schedule for today?"  
  * "Create a note titled 'Meeting ideas' and link it to my 'Q4 Planning' task."  
* **Implementation:**  
  * **Frontend:**  
    * Use the browser's Web Speech API for voice-to-text transcription.  
    * A dedicated input component sends the transcribed text to the backend.  
  * **Backend (Elysia):**  
    * Create a /command endpoint.  
    * Implement a Natural Language Processing (NLP) service. This can start simple with keyword matching (e.g., "add task", "remind me") and can be expanded later with a more robust NLP library.  
    * The service will parse the command to identify intent, entities (task title, date, board name), and actions.  
    * Based on the parsed command, the backend will perform the relevant actions (create a task, set a reminder, call the Notes Server API, etc.).

### **3.5. Smart Reminders & Notifications via HamBot**

* **Description:** Instead of simple in-app notifications, leverage HamBot to send reminders to the platforms you actually use (Discord, Slack, Telegram, etc.).  
* **Features:**  
  * Set reminders for specific tasks or as standalone commands.  
  * Configure recurring tasks (e.g., "Take out the trash every Tuesday at 8 pm") that are automatically handled by HamBot.  
* **Implementation:**  
  * **Backend:** A scheduler service (e.g., using a library like node-cron) will run on the Elysia server.  
  * The scheduler will periodically check the tasks table for upcoming due dates and reminders.  
  * When a reminder is due, the backend formats a payload (message, user ID, target platform) and sends it to the HamBot API endpoint. HamBot handles the rest.  
  * For recurring tasks, a separate recurring\_tasks table with a cron schedule will be used.

### **3.6. Integrated Pomodoro Timer**

* **Description:** A simple, elegant Pomodoro timer built into the UI to help with focus sessions.  
* **Features:**  
  * Standard Pomodoro timer (25 min work, 5 min break).  
  * Ability to link a Pomodoro session to a specific task.  
  * (Optional V2) Track completed Pomodoros per task/day.  
* **Implementation:**  
  * **Frontend:** This is primarily a frontend feature. Manage timer state (running, paused, on break) within a React component or a state management library.  
  * Use browser notifications or a subtle sound to signal the end of a session.  
  * When a session is linked to a task, the task can be highlighted in the UI.

### **3.7. The Universal Inbox**

* **Description:** A dedicated, single "Inbox" view that acts as a default destination for any new thought or task that hasn't been categorized yet. The goal is to capture everything with zero friction and sort it later.  
* **Features:**  
  * Default destination for the AI Command bar.  
  * Can receive tasks via DM to HamBot or by forwarding emails.  
  * A simple UI to quickly triage items from the Inbox to a specific Kanban board.  
* **Implementation:**  
  * **DB Schema:** A new inbox\_items table (id, title, description, source, created\_at).  
  * **Backend:** An endpoint for HamBot/email forwarding to post new items, logic in the /command endpoint to default to the inbox, and an API endpoint to move an inbox item to the tasks table.

### **3.8. Habit Tracker**

* **Description:** A dedicated module for tracking recurring daily or weekly habits, separate from one-off tasks. This helps build consistency and motivation through streaks.  
* **Features:**  
  * Create custom habits (e.g., "Exercise", "Read 30 mins").  
  * Daily checklist view and streak tracking.  
* **Implementation:**  
  * **DB Schema:** habits (id, user\_id, name, frequency) and habit\_logs (id, habit\_id, date, completed).  
  * **Frontend:** A new UI section for managing and tracking habits.

### **3.9. Productivity Analytics**

* **Description:** A private dashboard that visualizes personal productivity patterns to provide insights and motivation, without being punitive.  
* **Features:**  
  * Track tasks completed, Pomodoro sessions, and habit streaks.  
  * Visualize data with simple charts.  
  * A single, motivating "Flow Score" for the week.  
* **Implementation:**  
  * **Backend:** Create API endpoints that aggregate data from tasks, pomodoro\_sessions, and habit\_logs tables.  
  * **Frontend:** A dedicated "Analytics" page with chart components (e.g., using a library like Recharts).

### **3.10. Focus Mode**

* **Description:** A temporary, user-activated mode that hides all elements of the UI except for a specific project board or task list, minimizing distractions for deep work.  
* **Features:**  
  * Can be triggered manually or when starting a Pomodoro session.  
  * Hides notifications from other spaces and projects.  
  * (Optional) Can trigger HamBot to mute external notifications.  
* **Implementation:**  
  * **Frontend:** This is primarily a client-side state management feature. A global state will track if Focus Mode is active. UI components will conditionally render based on this state.  
  * **Backend:** An optional endpoint to tell HamBot to enter/exit a "focus" state for the user.

## **4\. Integration & Phased Development Plan**

This plan is designed to deliver value quickly and build features in a logical order.

### **Phase 0: Foundation & Setup (1 Week)**

1. **Project Scaffolding:** Set up monorepo with React (Vite) and ElysiaJS.  
2. **HamCloud Integration:**  
   * Implement user login/logout flow by integrating with HamCloud Auth.  
   * Establish a secure database connection from Elysia to the HamCloud Postgres DB.  
3. **Core UI Shell:** Build the main application layout, including the navigation and the prominent "Work/Personal" space switcher.  
4. **WebSocket Setup:** Establish the basic WebSocket connection between the frontend and backend.

### **Phase 1: The Core Kanban System (2 Weeks)**

1. **Backend CRUD:** Build all API endpoints for managing boards, columns, and tasks.  
2. **Database Modeling:** Implement the final DB schema for the Kanban system.  
3. **Frontend Kanban UI:** Develop the board view. Implement task creation, editing, and deletion.  
4. **Drag-and-Drop:** Integrate react-beautiful-dnd or a similar library to enable moving tasks and columns.  
5. **Real-Time Sync:** Use WebSockets to ensure that changes made on one device are instantly reflected on others.

### **Phase 2: Context and Time Management (2 Weeks)**

1. **Calendar Integration Backend:** Implement OAuth flow and API sync logic for Google Calendar.  
2. **Frontend Agenda View:** Create a new UI view that displays a combined list of tasks and calendar events for the day/week.  
3. **Task-to-Calendar Sync:** Ensure tasks with due dates are successfully created on the external calendar.

### **Phase 3: Automation & Intelligence (3 Weeks)**

1. **HamBot API Integration:** Define the API contract with HamBot and implement the backend logic to call it.  
2. **Scheduler Service:** Build the cron-based scheduler in Elysia to trigger reminders for tasks.  
3. **AI Command Parser (V1):** Develop the initial NLP service on the backend. Start with text-based commands and simple keyword/regex parsing for core actions.  
4. **Frontend Command Bar & Voice Input:** Build the UI for the command bar and integrate the Web Speech API.

### **Phase 4: Ancillary Features & Polish (2 Weeks)**

1. **Notes Server Integration:** Implement API calls to link tasks with notes. Add a "View Note" button in the task detail view.  
2. **Pomodoro Timer:** Build the timer component on the frontend.  
3. **UI/UX Polish:** Refine animations, improve responsiveness, and conduct thorough testing.

### **Phase 5: Core Enhancements (2 Weeks)**

1. **Universal Inbox:** Build the backend and frontend for the Inbox feature. Implement email/bot forwarding integration points.  
2. **Habit Tracker:** Develop the full CRUD for habits and the daily tracking UI.

### **Phase 6: Intelligence & Motivation (2 Weeks)**

1. **Productivity Analytics:** Create the backend aggregation endpoints and the frontend dashboard with visualizations.  
2. **Focus Mode:** Implement the state management and UI changes on the frontend for Focus Mode.

## **5\. Recommended Tech Stack**

Your suggested stack is excellent and well-suited for this project.

* **Frontend:** **React** with **Vite** (for fast development) and **TailwindCSS** (for rapid styling).  
* **Backend:** **ElysiaJS** on **Bun** (for exceptional performance and a great developer experience).  
* **Database:** **PostgreSQL** (provided by HamCloud).  
* **Real-Time:** **WebSockets** (native support in Elysia).  
* **State Management:** **Zustand** or **React Query** (lightweight and powerful).

## **6\. Future Vision: The Proactive Assistant**

Beyond the core feature set, HamFlow can evolve into a proactive system that anticipates needs and reduces cognitive load even further.

### **6.1. Smart Scheduling Assistant**

* **Concept:** An AI-driven assistant that analyzes your tasks, deadlines, and calendar to make intelligent suggestions for when to work on what.  
* **Example Interactions:**  
  * "You have a high-priority task 'Finish report' due tomorrow, and your afternoon is free. Should I block out a 90-minute focus session for it?"  
  * "You've added 5 new tasks to your 'Work' space today. Your schedule looks full. Would you like me to move the 'Clean the garage' task to Saturday?"

### **6.2. Journaling & Reflection Integration**

* **Concept:** A simple journaling space directly linked to your day's activities, prompting reflection to connect tasks with larger goals.  
* **Features:**  
  * End-of-day prompts: "What was your biggest win today?" or "What blocked your progress on \[Task Name\]?"  
  * Journal entries can be automatically populated with the day's completed tasks.  
  * Entries are stored securely in your Notes Server.