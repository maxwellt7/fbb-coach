# FBB Coach - AI Workout Programming & Tracking

A modern, full-featured workout tracking and programming application with AI coaching capabilities.

![FBB Coach](https://img.shields.io/badge/FBB-Coach-blue)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-green)

## Features

- **Dashboard** - Overview of your fitness journey with stats, streaks, and quick actions
- **Program Builder** - Create custom workout programs with exercises, sets, reps, and weights
- **Workout Tracker** - Real-time workout tracking with timer, set completion, and RPE logging
- **AI Coach** - GPT-powered fitness assistant for personalized advice and program recommendations
- **History & Analytics** - Track progress with charts, personal records, and workout history
- **Offline Support** - All workout data stored locally in browser

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express
- **AI**: OpenAI GPT-4o-mini
- **Vector DB**: Pinecone (optional, for custom knowledge base)
- **Charts**: Recharts
- **Routing**: React Router v6

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/maxwellt7/fbb-coach.git
cd fbb-coach
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```bash
cp env-example.txt .env
```

4. Add your API keys to `.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
PINECONE_API_KEY=your_pinecone_api_key_here  # Optional
PINECONE_INDEX=fitness-knowledge              # Optional
PORT=3001
```

5. Start the development servers:
```bash
# Terminal 1: Start the backend
npm run server

# Terminal 2: Start the frontend
npm run dev
```

6. Open http://localhost:5173 in your browser

### Running Both Servers Together

```bash
npm run dev:all
```

## Project Structure

```
fbb-coach/
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── services/       # API services
│   ├── store/          # Zustand state management
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app component
│   └── main.tsx        # Entry point
├── server/
│   └── index.js        # Express backend
├── public/             # Static assets
└── package.json
```

## Features in Detail

### Dashboard
- Total workouts, current streak, volume stats
- Today's scheduled workout from active program
- Recent workout history
- Quick action buttons

### Program Builder
- Create custom workout programs
- Add multiple workout days
- Configure exercises with sets, reps, and weights
- Template programs for quick start

### Workout Tracker
- Start from program or empty workout
- Real-time timer
- Track actual reps/weight vs targets
- RPE (Rate of Perceived Exertion) logging
- Post-workout rating and notes

### AI Coach
- Chat with GPT-powered fitness assistant
- Personalized advice based on your workout data
- Program generation
- Exercise recommendations
- Form cues and technique tips

### History & Analytics
- Volume over time charts
- Weekly workout frequency
- Personal records tracking
- Detailed workout logs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message to AI coach |
| `/api/search` | POST | Search knowledge base |
| `/api/generate-program` | POST | Generate workout program |
| `/api/health` | GET | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for AI features |
| `PINECONE_API_KEY` | No | Pinecone API key for custom knowledge |
| `PINECONE_INDEX` | No | Pinecone index name |
| `PORT` | No | Server port (default: 3001) |

## Deployment

### Vercel (Frontend)
```bash
npm run build
vercel deploy
```

### Railway/Render (Backend)
The app is configured for easy deployment to Railway or Render with the included configuration files.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Built with ❤️ for the fitness community
- Icons by [Lucide](https://lucide.dev/)
- Charts by [Recharts](https://recharts.org/)
