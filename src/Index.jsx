import "./style.css"
import logo from "./photo4.jpg";
import { useNavigate } from "react-router-dom";
import { userAPI } from "./services/api";
import React, { useState } from "react";
import { useUser } from "./UserContext";

function Index(){
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useUser();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await userAPI.login({ email: form.email, password: form.password });
    setLoading(false);
    if (res.success && res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('userData', JSON.stringify(res.user));
      setUser(res.user);
      navigate("/booking");
    } else {
      setError(res.message || 'Login failed.');
    }
  };

  return (
    <div className="Body">
      <form className="Main" onSubmit={handleSubmit}>
      <div id="logo">
        <img src={logo} alt="logo" />
      </div>
      <div id="login">
          <input type="text" name="email" placeholder="Email/Username" value={form.email} onChange={handleChange} required/>
          <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required/>
          <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'LOGIN'}</button>
          {loading && <div className="loading">Logging in...</div>}
          {error && <div className="error-message">{error}</div>}
        <div>
          Don't have an account? <a onClick={() => navigate("/signup")}>Sign Up</a>
        </div>
          {/* <button type="button" className="guest-btn" onClick={handleGuest}>Continue as Guest</button> */}
      </div>
    </form>
    </div>
  )
}

export default Index
