import React, { useState } from "react";
import "./style.css";
import logo from "./photo4.jpg";
import { BrowserRouter as Router, Routes, Route,useNavigate} from "react-router-dom";
import { authAPI } from "./services/api";

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!form.username || !form.email || !form.password || !form.confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const res = await authAPI.register({ username: form.username, email: form.email, password: form.password });
    setLoading(false);
    if (res.success) {
      setSuccess('Registration successful! Please login.');
      setTimeout(() => navigate("/"), 1500);
    } else {
      setError(res.message || 'Registration failed.');
    }
  };

  return (
    <div className="Body">
      <div className="Main">
        <div id="logo">
          <img src={logo} alt="logo" />
        </div>
        <form id="login" onSubmit={handleSubmit}>
          <input type="text" name="username" placeholder="Username" value={form.username} onChange={handleChange} required />
          <input type="text" name="email" placeholder="Email" value={form.email} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={form.password} onChange={handleChange} required />
          <input type="password" name="confirmPassword" placeholder="Re-enter your Password" value={form.confirmPassword} onChange={handleChange} required />
          <button type="submit" disabled={loading}>{loading ? 'Signing Up...' : 'SIGN UP'}</button>
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          <div>
            Already have an account? <a onClick={() => navigate("/")}>Login</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
