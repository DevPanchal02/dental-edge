# FILE: rename_data_files.py
# Place this script in the root of your DAT-Prep project (OUTSIDE the 'client' folder)

import os
import re
import sys

# --- Configuration ---
# Set the target directory relative to where the script is run
# Assumes script is in project root and data is in client/src/data
TARGET_DIR = os.path.join('client', 'src', 'data')
# --- End Configuration ---

def sanitize_foldername(name):
    """Sanitizes folder names: lowercase, spaces to hyphens."""
    new_name = name.lower()
    new_name = new_name.replace(' ', '-')
    # Remove any characters that are not lowercase letters, numbers, or hyphens
    new_name = re.sub(r'[^a-z0-9-]+', '', new_name)
    # Avoid consecutive hyphens (optional cleanup)
    new_name = re.sub(r'-+', '-', new_name)
    # Avoid leading/trailing hyphens (optional cleanup)
    new_name = new_name.strip('-')
    return new_name

def sanitize_filename(name):
    """Sanitizes file names: lowercase, spaces/# to underscores."""
    # Separate extension
    base, ext = os.path.splitext(name)
    ext = ext.lower() # Ensure extension is lowercase

    new_base = base.lower()
    new_base = new_base.replace('#', '_') # Replace hash first
    new_base = new_base.replace(' ', '_') # Replace spaces
    # Remove any characters that are not lowercase letters, numbers, or underscores
    new_base = re.sub(r'[^a-z0-9_]+', '', new_base)
     # Avoid consecutive underscores (optional cleanup)
    new_base = re.sub(r'_+', '_', new_base)
    # Avoid leading/trailing underscores (optional cleanup)
    new_base = new_base.strip('_')

    # Handle cases where the base becomes empty after sanitization
    if not new_base:
        new_base = "renamed_file" # Or generate a unique ID

    return f"{new_base}{ext}"

def rename_recursively(root_dir):
    """Walks the directory tree and renames files and folders."""
    if not os.path.isdir(root_dir):
        print(f"Error: Target directory '{root_dir}' not found.")
        print("Please make sure the script is run from the project root directory.")
        sys.exit(1)

    renamed_items = 0

    # Use topdown=False to process files before their parent directories
    for current_dir, subdirs, files in os.walk(root_dir, topdown=False):
        print(f"\nProcessing directory: {current_dir}")

        # --- Rename Files ---
        for filename in files:
            old_file_path = os.path.join(current_dir, filename)
            new_filename = sanitize_filename(filename)

            if new_filename != filename:
                new_file_path = os.path.join(current_dir, new_filename)
                try:
                    # Check for conflicts before renaming
                    if os.path.exists(new_file_path):
                         print(f"  [SKIP] File conflict: '{new_file_path}' already exists. Skipping rename for '{filename}'.")
                         continue

                    os.rename(old_file_path, new_file_path)
                    print(f"  [FILE] Renamed '{filename}' -> '{new_filename}'")
                    renamed_items += 1
                except OSError as e:
                    print(f"  [ERROR] Could not rename file '{filename}': {e}")
            # else:
            #     print(f"  [FILE] Keeping '{filename}' (already sanitized)")

        # --- Rename Subdirectories ---
        # We process directories *after* files because topdown=False
        for dirname in subdirs:
            old_dir_path = os.path.join(current_dir, dirname)
            new_dirname = sanitize_foldername(dirname)

            if new_dirname != dirname:
                new_dir_path = os.path.join(current_dir, new_dirname)
                try:
                     # Check for conflicts before renaming
                    if os.path.exists(new_dir_path):
                         print(f"  [SKIP] Directory conflict: '{new_dir_path}' already exists. Skipping rename for '{dirname}'.")
                         continue

                    os.rename(old_dir_path, new_dir_path)
                    print(f"  [DIR]  Renamed '{dirname}' -> '{new_dirname}'")
                    renamed_items += 1
                except OSError as e:
                    print(f"  [ERROR] Could not rename directory '{dirname}': {e}")
            # else:
            #     print(f"  [DIR]  Keeping '{dirname}' (already sanitized)")

    return renamed_items

# --- Main Execution ---
if __name__ == "__main__":
    abs_target_dir = os.path.abspath(TARGET_DIR)
    print("=" * 50)
    print("File & Folder Renaming Script")
    print("=" * 50)
    print(f"Target Directory: {abs_target_dir}")
    print("\nThis script will recursively:")
    print("  - Rename FOLDERS to lowercase, replacing spaces with hyphens (-).")
    print("  - Rename FILES to lowercase, replacing spaces and '#' with underscores (_).")
    print("  - Remove most other special characters.")
    print("\nWARNING: This operation is irreversible on the original files.")
    print("PLEASE BACK UP YOUR DATA BEFORE PROCEEDING.")
    print("-" * 50)

    confirm = input("Are you sure you want to proceed? (yes/no): ").lower()

    if confirm == 'yes':
        print("\nStarting renaming process...")
        count = rename_recursively(TARGET_DIR)
        print("\n" + "=" * 50)
        print(f"Renaming complete. {count} items renamed.")
        print("=" * 50)
        print("\nIMPORTANT: You may need to restart your Vite development server (`npm run dev`)")
        print("for the changes to be fully reflected in the application.")
    else:
        print("\nOperation cancelled.")