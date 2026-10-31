import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {EditorialVideo} from './editorial';
import {ApiExplainer, type ApiVideoProps} from './api';
import type {VideoProps} from './video';

const Root: React.FC = () => <>
  <Composition id="ExplainerVideo" component={EditorialVideo} width={1080} height={1920} fps={30} durationInFrames={3600} defaultProps={{storyboard: {title: 'Explainer', target_audience: 'Beginners', learning_objective: '', scenes: []}, audioPath: '', seconds: 60, captionCues: []} as VideoProps} />
  <Composition id="ApiExplainer" component={ApiExplainer} width={1080} height={1920} fps={30} durationInFrames={1800} defaultProps={{scenes: [], musicPath: '', seconds: 60} as ApiVideoProps} calculateMetadata={({props}) => ({durationInFrames: Math.max(30, Math.ceil(props.seconds * 30))})} />
</>;
registerRoot(Root);
