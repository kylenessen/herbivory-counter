# Leaf Herbivory Quantification Softwar...

## Problem Overview
Dina and her student Ben need to quantify herbivory on leaves from approximately 170 photos. Each photo shows leaves on white paper with a ruler for scale and a handwritten ID.

## Core Functionality

### Image Processing Requirements
- Identify handwritten ID on each sheet of paper
- Determine scale conversion (pixels to centimeters) using the ruler
- Isolate individual leaves using a polygon selection tool
- Overlay a grid (starting with square millimeter cells) on each leaf
- Allow users to click grid cells to mark herbivory damage

### Data Collection
For each leaf, store:
- Sheet ID (from handwritten label)
- Unique leaf identifier (e.g., 01, 02, 03)
- Scale conversion factor
- Total leaf area (in pixels)
- Herbivory area (in pixels)
- Count of herbivory cells, non-herbivory cells, and unsure/question cells
- Researcher identifier (name/initials, required for classification)

## User Interface Design

### Grid Visualization
- Default state: Grid cells show dark gray borders with light gray opacity fill (indicating no herbivory)
- Herbivory cells: Click to change to green or yellow fill
- Adjacent cells: Outer perimeter maintains thick border while interior borders become thin, creating a clear amorphous polygon boundary

### Zoom and Navigation
- Hold spacebar to zoom to 100% or 200% at cursor position
- Tap spacebar to toggle between zoomed and default view
- While zoomed, hold Command and drag to pan around the image
- Grid overlay scales with zoom level
- Default view: Entire leaf fills the software frame

### Interaction Controls
- Click cell: Mark as herbivory
- Shift-click cell: Revert to non-herbivory
- Each processing step requires explicit confirmation button

## Data Storage & Export

### Storage Solution
- SQLite database stored in the image directory
- Multiple tables for different data types (polygons, leaf metadata, app state)
- Enables reloading and editing previous work
- Robust against read/write changes

### CSV Export
- Generate CSV button in software interface
- Export includes: sheet ID, leaf ID, total cells, herbivory cells, question cells, scale conversion, researcher identifier
- Automatically dated filename
- Researchers can write R scripts for further analysis

## Technical Architecture

### Platform Choice
- Electron framework for cross-platform compatibility
- Uses web languages (HTML/CSS/JavaScript) - well-documented and AI-friendly
- Easy distribution for diverse operating systems
- Avoids web hosting requirements

### Project Structure
- Open source repository with download links
- Students download program, point to image folder
- SQLite database created automatically in target directory

## Workflow

### Initial Setup
1. Open application
2. Select directory containing leaf images
3. Software displays grid view of all images with completion status indicators

### Processing Steps (per image)
1. Enter sheet ID number
2. Set scale using ruler in image
3. Draw polygons around each leaf
4. Confirm completion - software crops leaves to polygon boundaries
5. For each cropped leaf: overlay auto-calculated grid (standardized to square millimeter based on scale)
6. Mark herbivory cells
7. Confirm leaf completion before proceeding

### State Management
- Software remembers last position and resumes sequentially
- All polygon and scale data persists in SQLite database

## Development Approach

### Testing Strategy
- Test-driven development (TDD)
- Write tests before implementing features
- Tests should include UI interaction simulation (clicking, zooming, etc.)

### Implementation Notes
- Focus on speed and efficiency for processing 170 images
- Balance robustness with simplicity - some brittleness acceptable for a working solution
- Non-technical biologists should find CSV outputs comfortable for data manipulation

## Transcript

Okay, this is a brainstorm on how I can build some software for Dina and her student Ben. What she's trying to do is take images of uh, leaves and accurately quantify how much herbivory is happening on those leaves. So to describe the problem, there are about 170 photos of uh, leaves being held on a white piece of paper with uh, a ruler present in the image. The initial processing of the photo requires one identifying the ID written uh, by hand on the sheet of paper, identifying the scale, so getting your conversion rate for pixels to centimeters and then isolating the leaves themselves using a polygon tool. Once you have those, that information and you've isolated the leaf, then the idea is to overlay a grid of some size. Uh, we need to experiment with that size. But just to begin, let's say square millimeter, grid size M. And then the user can click the grid cells where herbivory is. M. The information that is stored should be like the, It needs to be the ID associated with the sheet of paper. I don't really know what that means, but it looks important. A secondary unique identifier for each leaf. So it could be the identifier on the sheet 0102033. Uh, these images of the leaves, once they've been pulled out should be I think saved separately. Um, and it, the whole goal should be very quick. There needs to be a uh, second category. So a um, maybe or an unsure category. So by default the whole leaf will be counted as no or bigger. And then when you click a cell it changes that category to herbivory. In my mind I'm imagining the borders of the cell. Like it could by default, if it's nobivory, the grid cells are, have dark gray borders, um, and like maybe a light gray opacity fill. And then when you click an herbivory cell it turns green or yellow or something like that. And as you click adjacent cells, the um, the outer perimeter stays thick but the interior perimeter uh, loses that thick border. So build out your polygon, this amorphous polygon. Uh, you can see like a little more clearly the boundaries. Okay. Um, and since I'm just talking about nice to have features, when you hold space it should zoom in to maybe like 100%, 200% and the grid overlay should be preserved. Um, and once finished with a leaf or whatever, uh, the data that should be saved is the overarching identification, the individual leaf identification, the scale. The scale should be saved and then you can just count uh, maybe number of pixels. Yeah, Just count pixels. And. That the total pixels for the leaf and then the number of herbivory pixels. And then I think from that you have everything that you might need. Mhm. It's. Okay. Um, now we need to think about. What, what is the stack here, um, for this whole thing. So I am building this tool for non technical biologists. Um, they, they're very comfortable I would say with data manipulation. As long as it's in a like CSV. I think that would make them feel better. Right, because then they can open it up and inspect it. I think we should avoid things like SQL or JSON. Because then you have to have accessory scripts to make it work. I know CSVs can be brittle. Well, you know, maybe. Okay, let's think about this because I, I think I want to save other associated information. Um, like I would like for the program to be able to open up. Like I've already conducted some work in this folder and I would like to see where I was, that sort of thing. And so maybe a SQL Light database within the folder would be appropriate. And then in the software there's a like Generate CSV button and then it just creates a new CSV that's like well formatted. I think that might be a nice compromise. Um, because I believe SQL is like much more robust to um, read write changes, You know and I also like want, I don't want this like uber production ready system. I want to be able to just create a program that a student can download, click open and they get pointed to a folder or something like that. Say here's my folder with all my images and it saves, um, you know, it tracks. It becomes a little difficult. Or how about this? Uh, because there are. Not too many photos. Because there's not too many photos, maybe we can just import it into the program itself. And that way because I'm concerned about if they move pictures around within the directory, does that get seen as like a new photo? I think it would. Unless you had some logic to make it better. Um, I'm not sure what to do about that. Um. M. You know, like a little bit of brittleness in the interest of having this just be done and working I think is fine. Yeah, I don't know. Um, now just in terms of the actual application, I've used Electron in the past and I think that works pretty well with my students. Uh, you know I was actually able to. Distribute the software. Uh, it was a, it ended up being a good choice because as more people came aboard I had more diverse operating systems and Electron made that very easy to manage and so I was pretty stoked on that. So I'm thinking something similar maybe. I mean the alternative here is a website you could go to. But the problem with a website is then you have to host it. And I could, uh, I mean, I think it just becomes, It also becomes a little problematic. I don't want to host anything. I want to make a repo and I want to give some download links. I'll open source it, I don't care. I'll just make it very, uh, you know, this is kind of ephemeral software for me and I just, it's like kind of a fun project that's useful to my friends. So I think Electron, I think Electron's still a good choice because it uses web language, which is incredibly well documented. It's very AI friendly. I think what I'm describing, like I know it's possible because I did it for my masters. There's some decisions I would do differently, which I'm trying to do here. You know, maybe all it is is like you open a folder, right? Like you open the software and then you just find the directory where all your pictures are in it and the software will create a SQL database that just sits as a file in that directory and it, And it will, I don't know, we should actually question this idea if like a SQL database is required. Because what I would like to do. No, I like the SQL database. I think it's really solid, really well documented. SQLite is boring and bulletproof and it's not a lot to add, um, to generate a CSV in terms of logic, I think. And the file is there, you know, it's not, you know, any like technically minded person could just open it up and you know, I'm not hiding anything so they can take a look and get what they need. So I think that's good. And then just in the software there's a Generate CSV button and you can make that logic whatever you want. Uh, because then, yeah, I think it's better because then you can, in the SQLite you can have different tables for different purposes. Like you can have. A polygon table for what the leaves look like. And that way when you load it back up you can actually see the polygon again, maybe even edit it. You can adjust the scale bar. You know, all those like the states of the app, uh, can live in the SQL database. And when you want to analyze your information then you can just hit export and it will spit out a CSV for you. Within that directory, it can be dated automatically and it will have just like the, the things that the researchers want to see. Um, I don't want to get too in the weeds about like customizing the export. I don't know if that's really something. Well, I don't want to do that. We'll just give it to them and then they can write their R scripts too, do what they want to do with it. Okay. M. So what does the workflow look like? You open the app, you open the folder, it will take you to your last step, right? It'll just go sequentially through the images, and wherever you left off, that's where it will pick up. Maybe there is a grid view of images because there's not that many and you can have some indicator of whether they're complete or not. There needs to be a button that confirms you're done with each step. That's important and that needs to work and be robust. Mhm. Yeah. And I guess my idea is you're presented that image, you enter the ID number, you set the scale. Those are like green tasks. And then you draw the polygons around the leaves. When you're ready, you hit okay. And then the software will take those polygons of the leaves, Crop them to that those boundaries, and then present you those images. It will automatically calculate the grid size based on the scale so that it's like a square millimeter, right. Just to standardize across all of the images. Uh, its default all leaf, when you click, it turns to her bivory. If you shift click, it goes back to non herbivory. If you hold space, you will zoom in, maintaining the grid like it has to zoom in as well so that you can see the boundaries of the grid cell. And you can click from there. The zoom level should be like by default, the leaf should fill the frame of the software. It should fit in there so you can see the entire leaf. But when you zoom in, you can have different options. 100%, 200%, 300%. And you can make category changes from the zoom position. And maybe tapping spacebar zooms M in and it holds. And then tapping spacebar again zooms back out and it zooms in wherever the cursor is. And if you hold command and drag, you can move around the image while zoomed in. You got to hold command, click and drag something like that. Spacebar again, zoom out. It. Uh, okay. The database saves all these things and then the CSV export will just have the identification, both identifiers, the sheet and Each leaf, each row is a leaf and it will have like the encompassing group and then each individual leaf id, you'll have the total number of cells for that leaf, the total number of herbivore cells, the total number of question cells and the scale conversion. And also we should have an ability to identify who did the labeling. And so that is just a setting in the box. Like somewhere on the screen you put your name or initials, uh, that should be required to make any kind of classifications that should go on the export. And I think, I think that's it. Uh, I also want to say like this should be a test driven development. So the test should be written beforehand and then the software should work against uh, should. I've never really done test driven development so I think the AI will have to develop these things ahead of time. Those tests should include actually trying the software like clicking around and trying different stuff. I'm going to try anti gravity for this so I don't use too many of my tokens and. Maybe. Yeah, um, so that was a lot of specs. I would like you to interview me to make this stronger and ultimately I would like kind of a Kanban style body of uh, to do's or features that can be pulled down one after the other. And let's discuss.
