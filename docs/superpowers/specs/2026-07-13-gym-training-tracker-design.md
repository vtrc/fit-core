# Gym Training Tracker — Product Design

## 1. Scope

Build a private, multi-user gym training tracker. Users authenticate with Google through InsForge. Each user can create reusable routines, start workouts from saved routines or from scratch, record strength and cardio results, review history, and inspect statistics.

Automatic progression recommendations and social sharing are explicitly out of scope for the first version.

## 2. Domain Model

### User

Managed by InsForge authentication. All personal records are owned by one user.

### Exercise

An actionable activity such as chest press, seated row, or treadmill running. Each exercise has a type (strength or cardio), equipment or machine, one or more muscle groups, and supported metrics.

### Routine

A reusable plan owned by a user. It contains a name, optional description, ordered exercises, and planned values such as sets, repetitions, weight, duration, or rest.

### Workout

A real session performed on a specific date. It can be started from a saved routine or created as a free workout.

### Exercise Result

A summary recorded within a workout, not an individual-set log. Strength results can include weight, completed sets, total or average repetitions, and notes. Cardio results can include duration, distance, and machine-specific metrics such as speed, incline, calories, or resistance.

The routine is the plan; the workout is what actually happened.

## 3. User Flows

### Authentication and Home

The user signs in with Google. The home screen shows saved routines, an action to create a routine, an action to start a free workout, and access to history. An empty state offers the same primary actions when no routines exist.

### Routine Creation

The user enters a name, finds exercises by muscle group, equipment, or type, orders the selected exercises, configures planned values, and saves the routine.

### Workout Execution

The user starts from a saved routine or chooses a free workout. During the session, the user records a summary for each exercise, can add, remove, or skip exercises, and then saves or discards the session.

### History and Statistics

History lists workouts by date and exposes exercise-level details. Statistics show weight evolution, accumulated volume, training frequency, cardio time and distance, muscle-group distribution, and best recorded results. Statistics are derived from workout history rather than duplicated summary tables.

## 4. Architecture

Angular 22 owns the UI, navigation, client validation, loading states, and user interactions. InsForge provides Google authentication, PostgreSQL persistence, and row-level security.

Frontend areas:

- `auth`
- `dashboard`
- `routines`
- `workouts`
- `history`
- `statistics`
- `catalog`

Personal tables use `user_id` ownership and RLS policies so users can only read and modify their own routines and workouts. The shared exercise catalog is read-only from the application in the first version.

## 5. Validation and Error Handling

- A routine requires a name and at least one exercise.
- Strength values cannot be negative.
- Cardio requires at least one valid metric for the selected equipment.
- A workout cannot be completed without an exercise result.
- Loading, success, error, empty, expired-session, and offline states are represented explicitly.
- Save errors must explain that the data was not confirmed as saved and offer a retry.

## 6. Verification Strategy

The critical end-to-end path is:

`Google login → create routine → start workout → record result → save workout → view history`

Tests must cover authentication, user isolation through RLS, routine creation and editing, routine-based workouts, free workouts, strength results, cardio results, history, and statistics.

## 7. Explicit Non-Goals

- Automatic weight or difficulty recommendations.
- Sharing routines or workouts between users.
- Individual-set logging.
- Social features.
- Editing the shared catalog from the frontend.

