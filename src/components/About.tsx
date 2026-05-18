import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MapPin, Mail, Phone, MessageCircle, Youtube, Loader2, Send } from 'lucide-react';
import { db } from '../firebase';
import { collection, doc, getDoc, query, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export default function About() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDocs(query(collection(db, 'settings')));
        if (!docSnap.empty) {
           setSettings(docSnap.docs[0].data());
        } else {
           const gSnap = await getDoc(docRef);
           if (gSnap.exists()) {
             setSettings(gSnap.data());
           }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      await addDoc(collection(db, 'contact_messages'), {
        ...contactForm,
        status: 'unread',
        createdAt: serverTimestamp()
      });

      // Send email to admin
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contactForm),
        });
      } catch (err) {
        console.error('Failed to notify admin via email:', err);
      }

      setSubmitSuccess(true);
      setContactForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error: any) {
      console.error(error);
      setSubmitError(error.message || 'Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 max-w-5xl mx-auto w-full pt-20 sm:pt-8 relative overflow-y-auto custom-scrollbar no-select pb-24 md:pb-8">
      
      {/* Background Blobs */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-brand/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-brand-dark/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full mb-12 text-center"
      >
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-brand bg-brand/5 px-4 py-2 rounded-full border border-brand/10 mb-4 inline-block">
          Our Story
        </span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight mt-6 mb-4">
          About Us
        </h1>
        <div className="w-24 h-1.5 bg-gradient-brand mx-auto rounded-full" />
      </motion.div>

      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        
        {/* Left Column: About & Contact Info */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-12"
        >
          <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
            {settings?.aboutUsText || 'Welcome to our platform. We are dedicated to providing the best service to our clients.'}
          </div>

          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-premium glass-card">
            <h3 className="text-xl font-black text-slate-900 mb-6">Contact Information</h3>
            
            <div className="space-y-6">
              {settings?.address && (
                <div className="flex items-start gap-4 group">
                  <div className="w-12 h-12 bg-slate-50 group-hover:bg-brand/10 rounded-2xl flex items-center justify-center shrink-0 transition-colors border border-slate-100 group-hover:border-brand/20">
                    <MapPin className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Office Address</p>
                    <p className="text-slate-700 font-medium whitespace-pre-wrap">{settings.address}</p>
                  </div>
                </div>
              )}

              {settings?.email && (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-2xl transition-colors">
                  <div className="w-12 h-12 bg-slate-50 group-hover:bg-brand/10 rounded-2xl flex items-center justify-center shrink-0 transition-colors border border-slate-100 group-hover:border-brand/20">
                    <Mail className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Us</p>
                    <p className="text-slate-900 font-bold group-hover:text-brand transition-colors">{settings.email}</p>
                  </div>
                </a>
              )}

              {settings?.phone && (
                <a href={`tel:${settings.phone}`} className="flex items-center gap-4 group cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-2xl transition-colors">
                  <div className="w-12 h-12 bg-slate-50 group-hover:bg-brand/10 rounded-2xl flex items-center justify-center shrink-0 transition-colors border border-slate-100 group-hover:border-brand/20">
                    <Phone className="w-5 h-5 text-slate-500 group-hover:text-brand transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Call Us</p>
                    <p className="text-slate-900 font-bold group-hover:text-brand transition-colors">{settings.phone}</p>
                  </div>
                </a>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-4">
              {settings?.whatsapp && (
                <a 
                  href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center items-center gap-2 py-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-emerald-700 font-black tracking-wide transition-all active:scale-95"
                >
                  <MessageCircle className="w-5 h-5" />
                  WhatsApp
                </a>
              )}
              {settings?.youtube && (
                <a 
                  href={settings.youtube} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1 flex justify-center items-center gap-2 py-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl text-red-600 font-black tracking-wide transition-all active:scale-95"
                >
                  <Youtube className="w-5 h-5" />
                  YouTube
                </a>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right Column: Contact Form */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-premium glass-card relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-brand" />
            
            <h3 className="text-2xl font-black text-slate-900 mb-2 mt-2">Send us a message</h3>
            <p className="text-slate-500 font-medium text-sm mb-8">Fill out the form below and we'll get back to you shortly.</p>

            {submitSuccess ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 p-6 rounded-[1.5rem] text-center"
              >
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  <Send className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-emerald-900 mb-2">Message Sent!</h4>
                <p className="text-emerald-700 font-medium text-sm">Thank you for reaching out. We will get back to you soon.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-5">
                {submitError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
                    {submitError}
                  </div>
                )}
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-2">Your Name</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="John Doe"
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand focus:bg-white outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-2">Email Address</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand focus:bg-white outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-2">Phone Number</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+91 9876543210"
                    required
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand focus:bg-white outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 ml-2">Message</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="How can we help you?"
                    required
                    className="w-full min-h-[140px] px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-brand focus:bg-white outline-none transition-all custom-scrollbar resize-y"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Send Message
                      <Send className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
