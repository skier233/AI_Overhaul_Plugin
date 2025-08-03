#!/usr/bin/env python3

import json
import sys
import sqlite3
import os
from datetime import datetime
from pathlib import Path
import log

def main():
    """Main entry point for the AI Database Manager plugin"""
    input_data = None
    
    if len(sys.argv) < 2:
        input_data = read_json_input()
        log.LogDebug("Raw input: %s" % json.dumps(input_data))
    else:
        log.LogDebug("Using command line inputs")
        mode = sys.argv[1]
        log.LogDebug("Command line inputs: {}".format(sys.argv[1:]))
        
        input_data = {
            'args': {
                "mode": mode
            },
            'server_connection': {
                "Scheme": "http",
                "Port": 9999,
            }
        }
    
    output = {}
    run(input_data, output)
    
    out = json.dumps(output)
    print(out + "\n")

def read_json_input():
    """Read JSON input from stdin"""
    input_str = sys.stdin.read()
    return json.loads(input_str)

def run(input_data, output):
    """Main execution logic"""
    mode_arg = input_data['args'].get("mode", "")
    
    try:
        # Initialize database manager
        db_manager = AIInteractionDB()
        
        if mode_arg == "create_db":
            result = db_manager.create_database()
            output["output"] = f"Database created successfully at {result}"
            log.LogInfo(f"Database created at: {result}")
            
        elif mode_arg == "import_json":
            count = db_manager.import_from_json()
            output["output"] = f"Successfully imported {count} interactions from localStorage"
            log.LogInfo(f"Imported {count} interactions")
            
        elif mode_arg == "export_json":
            filename = db_manager.export_to_json()
            output["output"] = f"Successfully exported to {filename}"
            log.LogInfo(f"Exported to: {filename}")
            
        elif mode_arg == "sync":
            imported, exported = db_manager.sync_with_localstorage()
            output["output"] = f"Sync complete: imported {imported}, exported {exported}"
            log.LogInfo(f"Sync: imported {imported}, exported {exported}")
            
        elif mode_arg == "import_fresh":
            # This mode expects the user to have just exported fresh data from the browser
            count = db_manager.import_from_json()
            output["output"] = f"Fresh import complete: {count} interactions processed (duplicates skipped)"
            log.LogInfo(f"Fresh import: {count} interactions processed")
            
        elif mode_arg == "stats":
            stats = db_manager.get_statistics()
            output["output"] = stats
            log.LogInfo(f"Database statistics: {json.dumps(stats, indent=2)}")
            
        elif mode_arg == "cleanup":
            cleaned = db_manager.cleanup_old_data()
            output["output"] = f"Cleaned up {cleaned} old interactions"
            log.LogInfo(f"Cleaned {cleaned} old interactions")
            
        else:
            output["error"] = f"Unknown mode: {mode_arg}"
            log.LogError(f"Unknown mode: {mode_arg}")
            
    except Exception as e:
        output["error"] = str(e)
        log.LogError(f"Error in AI Database Manager: {str(e)}")
        return
    
    if "error" not in output and "output" not in output:
        output["output"] = "Operation completed successfully"

class AIInteractionDB:
    """SQLite database manager for AI interaction data"""
    
    def __init__(self):
        # Get the plugin directory from the script's location
        script_dir = Path(__file__).parent.resolve()
        
        # Default database location (same directory as the plugin)
        self.db_path = script_dir / "ai_interactions.db"
        
        # Create a backups directory in the plugin folder
        self.json_backup_dir = script_dir / "backups"
        self.json_backup_dir.mkdir(exist_ok=True)
        
        # Try common download directories as fallback
        self.fallback_json_dirs = []
        
        # Windows
        if os.name == 'nt':
            home = Path.home()
            self.fallback_json_dirs = [
                home / "Downloads",
                Path("C:/Users") / os.environ.get('USERNAME', 'User') / "Downloads"
            ]
        # macOS/Linux
        else:
            home = Path.home()
            self.fallback_json_dirs = [
                home / "Downloads",
                home / "Desktop"
            ]
        
        # Ensure the directory exists
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
    def create_database(self):
        """Create the SQLite database with proper schema"""
        log.LogInfo("Creating AI interactions database...")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create main interactions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                page TEXT,
                element TEXT,
                session_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                
                -- Scene data
                scene_id TEXT,
                scene_title TEXT,
                current_time REAL,
                duration REAL,
                progress REAL,
                volume REAL,
                playback_rate REAL,
                
                -- Button data
                button_text TEXT,
                button_class TEXT,
                
                -- Full JSON data for complex fields
                raw_data TEXT
            )
        ''')
        
        # Create performers table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interaction_performers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interaction_id INTEGER,
                performer_id TEXT,
                performer_name TEXT,
                FOREIGN KEY (interaction_id) REFERENCES interactions (id) ON DELETE CASCADE
            )
        ''')
        
        # Create tags table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interaction_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interaction_id INTEGER,
                tag_id TEXT,
                tag_name TEXT,
                FOREIGN KEY (interaction_id) REFERENCES interactions (id) ON DELETE CASCADE
            )
        ''')
        
        # Create markers table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interaction_markers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interaction_id INTEGER,
                marker_id TEXT,
                marker_title TEXT,
                marker_time TEXT,
                FOREIGN KEY (interaction_id) REFERENCES interactions (id) ON DELETE CASCADE
            )
        ''')
        
        # Create studio table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS interaction_studios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                interaction_id INTEGER,
                studio_id TEXT,
                studio_name TEXT,
                FOREIGN KEY (interaction_id) REFERENCES interactions (id) ON DELETE CASCADE
            )
        ''')
        
        # Create indexes for better query performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_timestamp ON interactions(timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_scene_id ON interactions(scene_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON interactions(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at)')
        
        conn.commit()
        conn.close()
        
        log.LogInfo(f"Database created successfully at: {self.db_path}")
        return str(self.db_path)
    
    def import_from_json(self, json_file=None):
        """Import interactions from JSON file or localStorage simulation"""
        if not self.db_path.exists():
            self.create_database()
            
        # Simulate reading from localStorage (in real implementation, this would be passed in)
        if json_file is None:
            json_files = []
            
            # First check the plugin's backup directory
            json_files.extend(self.json_backup_dir.glob("ai_interactions_*.json"))
            
            # Then check fallback directories (Downloads, etc.)
            for fallback_dir in self.fallback_json_dirs:
                if fallback_dir.exists():
                    json_files.extend(fallback_dir.glob("ai_interactions_*.json"))
            
            if not json_files:
                log.LogWarning(f"No AI interactions JSON files found in {self.json_backup_dir} or fallback directories: {[str(d) for d in self.fallback_json_dirs]}")
                return 0
                
            json_file = max(json_files, key=lambda f: f.stat().st_mtime)
            log.LogInfo(f"Using most recent JSON file: {json_file}")
        
        with open(json_file, 'r') as f:
            interactions = json.load(f)
        
        if not interactions:
            log.LogInfo("No interactions to import")
            return 0
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        imported_count = 0
        
        for interaction in interactions:
            # Extract main interaction data
            data = interaction.get('data', {})
            
            # Check if this interaction already exists (based on timestamp and session_id)
            cursor.execute('''
                SELECT id FROM interactions 
                WHERE timestamp = ? AND session_id = ?
            ''', (interaction.get('timestamp'), interaction.get('sessionId')))
            
            existing = cursor.fetchone()
            if existing:
                log.LogDebug(f"Skipping duplicate interaction: {interaction.get('type')} at {interaction.get('timestamp')}")
                continue
            
            # Insert main interaction
            cursor.execute('''
                INSERT INTO interactions (
                    type, timestamp, page, element, session_id,
                    scene_id, scene_title, current_time, duration, progress,
                    volume, playback_rate, button_text, button_class, raw_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                interaction.get('type'),
                interaction.get('timestamp'),
                interaction.get('page'),
                interaction.get('element'),
                interaction.get('sessionId'),
                data.get('sceneId'),
                data.get('sceneTitle'),
                data.get('currentTime'),
                data.get('duration'),
                data.get('progress'),
                data.get('volume'),
                data.get('playbackRate'),
                data.get('buttonText'),
                data.get('buttonClass'),
                json.dumps(data)
            ))
            
            interaction_id = cursor.lastrowid
            
            # Insert performers
            performers = data.get('performers', [])
            for performer in performers:
                cursor.execute('''
                    INSERT INTO interaction_performers (interaction_id, performer_id, performer_name)
                    VALUES (?, ?, ?)
                ''', (interaction_id, performer.get('id'), performer.get('name')))
            
            # Insert tags
            tags = data.get('tags', [])
            for tag in tags:
                cursor.execute('''
                    INSERT INTO interaction_tags (interaction_id, tag_id, tag_name)
                    VALUES (?, ?, ?)
                ''', (interaction_id, tag.get('id'), tag.get('name')))
            
            # Insert markers
            markers = data.get('markers', [])
            for marker in markers:
                cursor.execute('''
                    INSERT INTO interaction_markers (interaction_id, marker_id, marker_title, marker_time)
                    VALUES (?, ?, ?, ?)
                ''', (interaction_id, marker.get('id'), marker.get('title'), marker.get('time')))
            
            # Insert studio
            studio = data.get('studio')
            if studio:
                cursor.execute('''
                    INSERT INTO interaction_studios (interaction_id, studio_id, studio_name)
                    VALUES (?, ?, ?)
                ''', (interaction_id, studio.get('id'), studio.get('name')))
            
            imported_count += 1
            
            # Progress logging for large imports
            if imported_count % 100 == 0:
                log.LogProgress(imported_count / len(interactions))
        
        conn.commit()
        conn.close()
        
        log.LogInfo(f"Successfully imported {imported_count} interactions")
        return imported_count
    
    def export_to_json(self):
        """Export all interactions to JSON file"""
        if not self.db_path.exists():
            raise Exception("Database does not exist. Please create it first.")
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get all interactions with related data
        cursor.execute('''
            SELECT * FROM interactions ORDER BY timestamp DESC
        ''')
        
        interactions = []
        for row in cursor.fetchall():
            interaction_id = row[0]
            
            # Get performers
            cursor.execute('SELECT performer_id, performer_name FROM interaction_performers WHERE interaction_id = ?', (interaction_id,))
            performers = [{'id': p[0], 'name': p[1]} for p in cursor.fetchall()]
            
            # Get tags
            cursor.execute('SELECT tag_id, tag_name FROM interaction_tags WHERE interaction_id = ?', (interaction_id,))
            tags = [{'id': t[0], 'name': t[1]} for t in cursor.fetchall()]
            
            # Get markers
            cursor.execute('SELECT marker_id, marker_title, marker_time FROM interaction_markers WHERE interaction_id = ?', (interaction_id,))
            markers = [{'id': m[0], 'title': m[1], 'time': m[2]} for m in cursor.fetchall()]
            
            # Get studio
            cursor.execute('SELECT studio_id, studio_name FROM interaction_studios WHERE interaction_id = ?', (interaction_id,))
            studio_row = cursor.fetchone()
            studio = {'id': studio_row[0], 'name': studio_row[1]} if studio_row else None
            
            # Reconstruct interaction object
            data = json.loads(row[16]) if row[16] else {}  # raw_data column
            if performers:
                data['performers'] = performers
            if tags:
                data['tags'] = tags
            if markers:
                data['markers'] = markers
            if studio:
                data['studio'] = studio
            
            interaction = {
                'type': row[1],
                'timestamp': row[2],
                'page': row[3],
                'element': row[4],
                'sessionId': row[5],
                'data': data
            }
            
            interactions.append(interaction)
        
        conn.close()
        
        # Export to JSON file in the plugin's backup directory
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        filename = self.json_backup_dir / f"ai_interactions_export_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(interactions, f, indent=2)
        
        log.LogInfo(f"Exported {len(interactions)} interactions to {filename}")
        return str(filename)
    
    def sync_with_localstorage(self):
        """Sync database with localStorage data (import from most recent files, export current DB)"""
        # Import from the most recent JSON files (which should include fresh localStorage exports)
        imported = self.import_from_json()
        exported_file = self.export_to_json()
        
        # Log what we found
        log.LogInfo(f"Sync completed: imported {imported} new interactions, exported to {exported_file}")
        
        return imported, exported_file
    
    def get_statistics(self):
        """Get database statistics"""
        if not self.db_path.exists():
            return {"error": "Database does not exist"}
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        stats = {}
        
        # Total interactions
        cursor.execute('SELECT COUNT(*) FROM interactions')
        stats['total_interactions'] = cursor.fetchone()[0]
        
        # Interactions by type
        cursor.execute('SELECT type, COUNT(*) FROM interactions GROUP BY type ORDER BY COUNT(*) DESC')
        stats['by_type'] = dict(cursor.fetchall())
        
        # Unique scenes
        cursor.execute('SELECT COUNT(DISTINCT scene_id) FROM interactions WHERE scene_id IS NOT NULL')
        stats['unique_scenes'] = cursor.fetchone()[0]
        
        # Date range
        cursor.execute('SELECT MIN(timestamp), MAX(timestamp) FROM interactions')
        date_range = cursor.fetchone()
        stats['date_range'] = {'earliest': date_range[0], 'latest': date_range[1]}
        
        # Sessions
        cursor.execute('SELECT COUNT(DISTINCT session_id) FROM interactions')
        stats['unique_sessions'] = cursor.fetchone()[0]
        
        conn.close()
        return stats
    
    def cleanup_old_data(self, days_to_keep=30):
        """Clean up interactions older than specified days"""
        if not self.db_path.exists():
            return 0
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Delete old interactions (cascading to related tables)
        cursor.execute('''
            DELETE FROM interactions 
            WHERE created_at < datetime('now', '-{} days')
        '''.format(days_to_keep))
        
        cleaned_count = cursor.rowcount
        conn.commit()
        conn.close()
        
        log.LogInfo(f"Cleaned up {cleaned_count} interactions older than {days_to_keep} days")
        return cleaned_count

if __name__ == "__main__":
    main()