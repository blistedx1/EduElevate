/*! Giterp Multi-School Enterprise ERP Core v1.2.0 */
'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function RequestDemoPage() {
  const [formData, setFormData] = useState({
    schoolName: '',
    city: '',
    strength: '',
    board: '',
    contactName: '',
    email: '',
    phone: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const res = await fetch('/api/request-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setIsSuccess(true);
        setStatus("Thanks — that's on our desk now. Our team will reach out within 2 business days.");
        setFormData({
          schoolName: '',
          city: '',
          strength: '',
          board: '',
          contactName: '',
          email: '',
          phone: '',
          notes: ''
        });
      } else {
        setIsSuccess(false);
        setStatus(data.error || 'Failed to submit request. Please try again.');
      }
    } catch (err: any) {
      setIsSuccess(false);
      setStatus("Thanks — that's on our desk now. Our team will reach out within 2 business days.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="demo-split-layout">
      {/* Left chalkboard panel */}
      <div className="panel">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/giterp-logo.png" alt="EduElevate Logo" className="w-10 h-10 rounded-xl object-contain shadow-sm bg-[#122A24] border border-white/20 p-1" />
          <span className="brand-text">
            EduElevate
            <span>Manage • Mentor • Elevate</span>
          </span>
        </Link>

        <div className="panel-mid">
          <p className="eyebrow">Request a Demo</p>
          <h1>Tell us about your coaching institute — we'll take it from there.</h1>
          <p>
            There's no self-serve signup. Our team reviews every request and provisions your coaching branch directly, so your batches and mentor roles start correctly from day one.
          </p>

          <ul className="whatnext">
            <li><span className="b">01.</span> We review your branch request within 2 business days.</li>
            <li><span className="b">02.</span> A quick discussion to map your course batches &amp; faculty roles.</li>
            <li><span className="b">03.</span> We create your coaching workspace and issue a unique Branch Code.</li>
          </ul>
        </div>

        <p style={{ position: 'relative', zIndex: 2, fontSize: '12px', opacity: 0.85, color: '#F1F5F9', margin: 0 }}>
          Already set up?{' '}
          <Link href="/login" style={{ textDecoration: 'underline', color: '#FFFFFF', fontWeight: 600 }}>
            Sign in here
          </Link>
        </p>
      </div>

      {/* Right form panel */}
      <div className="formside">
        <div className="card">
          <p className="kicker">New Coaching Branch</p>
          <h2>Request a demo</h2>
          <p className="sub">A few details so our team can reach out and configure your branch workspace.</p>

          <form onSubmit={handleSubmit}>
            <div className="grid2">
              <div className="field">
                <label htmlFor="schoolName">Coaching / Institute name</label>
                <input
                  type="text"
                  id="schoolName"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  placeholder="e.g. EduElevate Institute, Lucknow Branch"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="city">Branch City</label>
                <input
                  type="text"
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Lucknow"
                  required
                />
              </div>
            </div>

            <div className="grid2">
              <div className="field">
                <label htmlFor="strength">Aspirant strength</label>
                <input
                  type="text"
                  id="strength"
                  value={formData.strength}
                  onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                  placeholder="e.g. 500"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="board">Courses / Target exams</label>
                <input
                  type="text"
                  id="board"
                  value={formData.board}
                  onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                  placeholder="e.g. JEE, NEET, CBSE, Foundation"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="contactName">Your name &amp; role</label>
              <input
                type="text"
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="e.g. Dr. Rajesh Sharma, Center Director"
                required
              />
            </div>

            <div className="grid2">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="you@eduelevate.in"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input
                  type="tel"
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 …"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">What would you like to digitise first?</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g. Attendance and fee tracking to start"
              />
            </div>

            <button type="submit" className="submit" disabled={loading}>
              <span className="stamp-icon">✓</span>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>

            {status && (
              <p
                style={{
                  marginTop: '16px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: isSuccess ? '#122A24' : '#C4432B',
                  background: isSuccess ? '#ecfdf5' : '#fff1f2',
                  padding: '12px 14px',
                  borderRadius: '7px',
                  border: isSuccess ? '1px solid #a7f3d0' : '1px solid #fecdd3'
                }}
              >
                {status}
              </p>
            )}
          </form>

          <Link className="back" href="/">← Back to Giterp</Link>
        </div>
      </div>
    </div>
  );
}
