import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { UserProvider } from "./UserContext";
import Index from "./Index";
import Signup from "./Signup";
import Booking from "./Book";
import Movie from "./Movie";
import Theater from "./components/Theater";
import Confirmation from "./components/Confirmation";

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/movie" element={<Movie />} />
          <Route path="/theater/:movieId" element={<Theater />} />
          <Route path="/confirmation" element={<Confirmation />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
