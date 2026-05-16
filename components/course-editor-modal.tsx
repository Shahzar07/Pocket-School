'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Course, CourseType } from '@/lib/db';
import { createCourse, updateCourse } from '@/lib/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Course | null;
  ownerId: string;
  ownerName?: string;
  onSaved: () => void;
}

const TYPES: { id: CourseType; label: string }[] = [
  { id: 'course', label: 'Course' },
  { id: 'ebook', label: 'eBook' },
  { id: 'exam', label: 'Exam Paper' },
  { id: 'solutions', label: 'Exam Solutions' },
  { id: 'paper', label: 'Past Paper' },
  { id: 'bundle', label: 'Bundle' },
];

const CATEGORIES = [
  'Mathematics', 'Science', 'English', 'History', 'Languages',
  'Art', 'Technology', 'Business', 'Music', 'Other',
];

const LEVELS = ['All', 'Primary', 'Secondary', 'GCSE', 'A-Level', 'University'];

export default function CourseEditorModal({
  open, onOpenChange, initial, ownerId, ownerName, onSaved,
}: Props) {
  const [activeTab, setActiveTab] = useState('basic');
  const [saving, setSaving] = useState(false);

  // Tab 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CourseType>('course');
  const [category, setCategory] = useState('Mathematics');
  const [subject, setSubject] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // Tab 2
  const [level, setLevel] = useState('All');
  const [price, setPrice] = useState<string>('0');
  const [currency, setCurrency] = useState('GBP');
  const [whatYouLearn, setWhatYouLearn] = useState('');
  const [requirements, setRequirements] = useState('');
  const [tags, setTags] = useState('');

  // Tab 3
  const [workbookUrl, setWorkbookUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [durationHours, setDurationHours] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title ?? '');
      setDescription(initial.description ?? '');
      setType((initial.type as CourseType) ?? 'course');
      setCategory(initial.category ?? 'Mathematics');
      setSubject(initial.subject ?? '');
      setThumbnailUrl(initial.thumbnailUrl ?? '');
      setLevel(initial.level ?? 'All');
      setPrice(String(initial.price ?? 0));
      setCurrency(initial.currency ?? 'GBP');
      setWhatYouLearn((initial.whatYouLearn ?? []).join('\n'));
      setRequirements((initial.requirements ?? []).join('\n'));
      setTags((initial.tags ?? []).join(', '));
      setWorkbookUrl(initial.workbookUrl ?? '');
      setPreviewUrl(initial.previewUrl ?? '');
      setDurationHours(initial.durationHours ? String(initial.durationHours) : '');
      setIsPublic(initial.isPublic ?? true);
    } else {
      setTitle(''); setDescription(''); setType('course'); setCategory('Mathematics');
      setSubject(''); setThumbnailUrl(''); setLevel('All'); setPrice('0');
      setCurrency('GBP'); setWhatYouLearn(''); setRequirements(''); setTags('');
      setWorkbookUrl(''); setPreviewUrl(''); setDurationHours(''); setIsPublic(true);
    }
    setActiveTab('basic');
  }, [open, initial]);

  const save = async (publish: boolean) => {
    if (!title.trim()) { toast.error('Title is required.'); setActiveTab('basic'); return; }
    if (!description.trim()) { toast.error('Description is required.'); setActiveTab('basic'); return; }

    const payload: Omit<Course, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      ownerId,
      ownerName,
      thumbnailUrl: thumbnailUrl.trim() || undefined,
      status: publish ? 'published' : 'draft',
      subject: subject.trim() || undefined,
      type,
      category,
      level,
      price: Number(price) || 0,
      currency: currency.trim() || 'GBP',
      isPublic,
      whatYouLearn: whatYouLearn.split('\n').map(s => s.trim()).filter(Boolean),
      requirements: requirements.split('\n').map(s => s.trim()).filter(Boolean),
      tags: tags.split(',').map(s => s.trim()).filter(Boolean),
      workbookUrl: workbookUrl.trim() || undefined,
      previewUrl: previewUrl.trim() || undefined,
      durationHours: durationHours ? Number(durationHours) : undefined,
    };

    try {
      setSaving(true);
      if (initial?.id) {
        await updateCourse(initial.id, payload);
        toast.success('Course updated.');
      } else {
        await createCourse(payload);
        toast.success(publish ? 'Course published.' : 'Draft saved.');
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Product' : 'Create New Product'}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="basic">1. Basic</TabsTrigger>
            <TabsTrigger value="details">2. Details</TabsTrigger>
            <TabsTrigger value="content">3. Content</TabsTrigger>
            <TabsTrigger value="review">4. Review</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ce-title">Title *</Label>
              <Input id="ce-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. GCSE Biology — Cell Respiration" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-desc">Description *</Label>
              <Textarea id="ce-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this product about?" rows={4} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => v && setType(v as CourseType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-subject">Subject (optional)</Label>
              <Input id="ce-subject" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Biology" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-thumb">Thumbnail URL (optional)</Label>
              <Input id="ce-thumb" value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://…" />
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={level} onValueChange={(v) => v && setLevel(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ce-dur">Duration (hours, optional)</Label>
                <Input id="ce-dur" type="number" min="0" step="0.5" value={durationHours} onChange={e => setDurationHours(e.target.value)} placeholder="e.g. 12" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ce-price">Price (0 = free)</Label>
                <Input id="ce-price" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-learn">What learners will get (one per line)</Label>
              <Textarea id="ce-learn" value={whatYouLearn} onChange={e => setWhatYouLearn(e.target.value)} rows={4} placeholder={'Understand cell respiration\nApply ATP cycle to exam questions\n…'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-req">Requirements / prerequisites (one per line)</Label>
              <Textarea id="ce-req" value={requirements} onChange={e => setRequirements(e.target.value)} rows={3} placeholder={'Basic GCSE biology\nA notebook'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-tags">Tags (comma-separated)</Label>
              <Input id="ce-tags" value={tags} onChange={e => setTags(e.target.value)} placeholder="GCSE, biology, revision" />
            </div>
          </TabsContent>

          <TabsContent value="content" className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ce-wb">Workbook / PDF URL (optional)</Label>
              <Input id="ce-wb" value={workbookUrl} onChange={e => setWorkbookUrl(e.target.value)} placeholder="https://…/workbook.pdf" />
              <p className="text-xs text-muted-foreground">Available to buyers / enrolled students after purchase.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-prev">Free preview URL (optional)</Label>
              <Input id="ce-prev" value={previewUrl} onChange={e => setPreviewUrl(e.target.value)} placeholder="https://… (video or PDF preview)" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Public marketplace listing</p>
                <p className="text-xs text-muted-foreground">Visible on the public /courses page (no sign-in required to browse).</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </TabsContent>

          <TabsContent value="review" className="space-y-3">
            <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
              <p><span className="font-semibold">Title:</span> {title || <em className="text-muted-foreground">missing</em>}</p>
              <p><span className="font-semibold">Type:</span> {type} · <span className="font-semibold">Category:</span> {category} · <span className="font-semibold">Level:</span> {level}</p>
              <p><span className="font-semibold">Price:</span> {Number(price) === 0 ? 'Free' : `${currency} ${price}`}</p>
              <p><span className="font-semibold">Public:</span> {isPublic ? 'Yes (marketplace listing)' : 'No (only for direct link)'}</p>
              <p className="text-muted-foreground">{description}</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save as draft'}
              </Button>
              <Button onClick={() => save(true)} disabled={saving} className="bg-google-blue hover:bg-[#1967D2] text-white">
                {saving ? 'Publishing…' : 'Publish now'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
