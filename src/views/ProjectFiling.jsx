import React, { useState, useEffect } from 'react';
import { FolderOpen, File, UploadCloud, Users, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '../components/Toast';

const PROJECTS_API = 'http://localhost:5000/api/projects';

// Ordered project lifecycle stages, used to drive the timeline from real status.
const PROJECT_STAGES = ['Quotation Approved', 'Advance Payment', 'Project File Created', 'Handover Pending'];

const TimelineStep = ({ label, active, completed }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1, position: 'relative' }}>
    <div style={{
      width: '24px', height: '24px', borderRadius: '50%', zIndex: 1,
      backgroundColor: completed ? 'var(--success-color)' : active ? 'var(--surface-color)' : 'var(--surface-color)',
      border: completed ? 'none' : active ? '2px solid var(--warning-color)' : '2px solid var(--border-color)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
    }}>
      {completed ? <CheckCircle size={14} /> : active ? <Clock size={14} color="var(--warning-color)" /> : null}
    </div>
    <span style={{ fontSize: '0.75rem', textAlign: 'center', color: active || completed ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: active || completed ? '600' : '400' }}>
      {label}
    </span>
  </div>
);

const ProjectFiling = () => {
  const addToast = useToast();
  const [projectsData, setProjectsData] = useState([]);

  // Load live projects from API (no hardcoded seed / fallback data)
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(PROJECTS_API);
        const data = await res.json();
        if (Array.isArray(data)) setProjectsData(data);
      } catch (err) {
        console.error('Failed to load projects:', err);
      }
    };
    load();
  }, []);

  const handleDeleteProject = (id) => {
    if (!window.confirm('Delete this project file?')) return;
    setProjectsData((prev) => prev.filter((p) => p.id !== id));
    fetch(`${PROJECTS_API}/${id}`, { method: 'DELETE' }).catch((err) => console.error('Failed to delete project:', err));
    addToast('Project file deleted', 'info');
  };

  // Resolve a project's progress index against the lifecycle stages.
  const stageIndex = (status) => {
    const s = (status || '').toLowerCase();
    if (/complete|delivered|closed|handover complete/.test(s)) return PROJECT_STAGES.length; // fully done
    const idx = PROJECT_STAGES.findIndex((st) => st.toLowerCase() === s);
    return idx; // -1 if unknown
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Project Filing</h2>
        <button className="btn btn-primary" style={{ display: 'flex', gap: '0.5rem' }} onClick={() => addToast('Opening New Project File modal...')}>
          <FolderOpen size={16} /> New Project File
        </button>
      </div>

      {projectsData.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1.5rem' }}>
          No project files yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '1.5rem' }}>
        {projectsData.map((project) => {
        const curIdx = stageIndex(project.status);
        return (
          <div key={project.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '600', color: 'var(--primary-color)' }}>{project.id}</h3>
                <h4 style={{ margin: '0.25rem 0', fontSize: '1rem', fontWeight: '500' }}>{project.client}</h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{project.type}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-success" style={{ marginBottom: '0.25rem' }}>{project.status}</span>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600' }}>Quote: {project.quote}</p>
                <button onClick={() => handleDeleteProject(project.id)} style={{ marginTop: '0.5rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', fontSize: '0.7rem', fontWeight: '600', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', marginTop: '0.5rem' }}>
               <div style={{ position: 'absolute', top: '12px', left: '10%', right: '10%', height: '2px', backgroundColor: 'var(--border-color)', zIndex: 0 }}></div>
               {PROJECT_STAGES.map((stage, i) => (
                 <TimelineStep
                   key={stage}
                   label={stage}
                   completed={curIdx > i || curIdx === PROJECT_STAGES.length}
                   active={curIdx === i}
                 />
               ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'var(--background-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Users size={16} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{project.team}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <File size={16} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{project.files} Documents Uploaded</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => addToast(`Opening file picker for ${project.id}`)}>
                  <UploadCloud size={14} /> Upload Files
                </button>
                <button className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', color: 'var(--primary-color)', borderColor: 'var(--primary-color)' }} onClick={() => addToast(`Viewing documents for ${project.id}`)}>
                  View Documents
                </button>
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};

export default ProjectFiling;
